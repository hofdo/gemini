# Refactoring Handover

## Project overview

Interactive RPG/storytelling platform. Three-tier architecture:

```
llama-chat (Angular 21, :4200)
    ↓ dev-proxy: /chat /assist /generate-* /config /health
llama-proxy (FastAPI, :8000)
    ↓ httpx streaming
llm (llama-server / llama.cpp, :8080)
```

Two LLM backends:
- `gemma4-uncensored` — HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive (Q6_K_P), temperature=1.0, top_p=0.95, top_k=64
- `qwen3-uncensored` — HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive (Q8_0), temperature=0.7, top_p=0.8, top_k=20, min_p=0.0

llama-server is started with `--jinja` flag — uses each model's embedded Jinja2 chat template (Gemma uses `<|turn>` / `<turn|>` tokens; `--jinja` handles assistant→model role mapping automatically).

## Current state of key files

### Backend

- `apps/llama-proxy/main.py` — **816 lines, single file**. Contains all Pydantic models, config, LLM helpers, prompt builders, and endpoints. This is the primary refactoring target.
- `apps/llama-proxy/pyproject.toml` — three deps: `fastapi`, `uvicorn[standard]`, `httpx`. `json-repair` not yet added.
- llama-server launched via `scripts/start-llm.sh` — accepts `gemma4-uncensored` or `qwen3-uncensored`.

### Frontend

- All components standalone (no NgModules). State via Angular signals (`signal()`, `.set()`, `.update()`).
- Routes: `/ → MenuComponent` → `scenario/:mode → ScenarioFormComponent` → `/chat → ChatComponent` or `/dm → DmComponent` → `/settings → SettingsComponent`
- Key services (all `providedIn: 'root'`): `ChatService`, `AiAssistService`, `ScenarioService`, `SettingsService`, `PresetScenarioService`
- Preset scenarios stored in `apps/llama-chat/public/scenarios/` as static JSON, served as assets. `index.json` is the manifest. Currently one preset: `adventure/isekai-reborn.json`.

## What was already done (do not redo)

- Added `min_p` field to all three LLM payload dicts in `main.py`
- Added `--jinja` flag to `scripts/start-llm.sh`
- Gemma params corrected: temperature=1.0, top_k=64
- `PresetScenarioService` created, preset picker added to `ScenarioFormComponent`
- `CLAUDE.md` created at repo root

## Refactoring plan — do in this order

### Phase 1 — Quick wins (no behavior change)

**1.1** `MenuComponent`: constructor injection → `inject()`
- File: `apps/llama-chat/src/app/menu/menu.component.ts`
- Remove `constructor(private router: Router) {}`, add `private router = inject(Router)` as field

**1.2** Type `generateNpc` return value
- Add `GeneratedNpcRaw` interface to `apps/llama-chat/src/app/dm/dm.model.ts` (snake_case API shape: name, description, personality, stats, foes, friends, plot_twists, etc.)
- Change `Promise<any>` → `Promise<GeneratedNpcRaw>` in `apps/llama-chat/src/app/shared/ai-assist.service.ts`

**1.3** Replace `ngAfterViewChecked` auto-scroll with `effect()`
- File: `apps/llama-chat/src/app/chat/chat.component.ts`
- Remove `AfterViewChecked` interface + `ngAfterViewChecked`
- Add `effect()` that reads `chatService.messages()` and `chatService.loading()`, then schedules scroll

**1.4** Thread-safe `active_backend`
- File: `apps/llama-proxy/main.py`
- Add `import threading; _backend_lock = threading.Lock()`
- Wrap `active_backend` mutation in `PATCH /config/backend` handler with `with _backend_lock:`
- Capture `backend = active_backend` under lock at top of `stream_chat` and `call_llm` (before the async httpx block — do not hold lock across awaits)

**1.5** Extract `_build_payload` helper
- File: `apps/llama-proxy/main.py`
- The payload dict `{model, messages, temperature, top_p, top_k, repeat_penalty, min_p}` is duplicated in `stream_chat`, `call_llm`, and the legacy non-streaming `/chat` block
- Extract to `def _build_payload(backend, messages, *, stream=False, json_mode=False) -> dict`

---

### Phase 2 — Backend structural refactor (split `main.py`)

**Do as one atomic commit** — broken import graph mid-way.

**Target structure:**
```
apps/llama-proxy/
  config.py        ← _DEFAULT_BACKENDS, active_backend, _backend_lock, logger
  models.py        ← all Pydantic models
  llm.py           ← _build_payload, stream_chat, call_llm
  prompts.py       ← build_system_prompt, build_interpersonal_system_prompt, build_kickoff_prompt
  json_utils.py    ← _strip_fences, _extract_json_object, _fix_retry_messages + json-repair
  routes/
    __init__.py
    chat.py        ← POST /chat
    generate.py    ← /assist, /generate-scenario, /generate-npc, /generate-quest
    backends.py    ← GET /config/backends, PATCH /config/backend, GET /health
  main.py          ← app init + include_router only (~30 lines)
```

**Sequencing:** `config.py` → `models.py` → `json_utils.py` → `prompts.py` → `llm.py` → `routes/` → rewrite `main.py`.

**Import style:** uvicorn launches as `uvicorn main:app --reload` from inside `apps/llama-proxy/` (see `apps/llama-proxy/project.json`). Use **absolute imports** throughout (`from config import active_backend`, NOT `from .config import ...`).

**Step 2.1 — Add json-repair:**
- Add `"json-repair>=0.30.0"` to `pyproject.toml` dependencies
- Run `npx nx run llama-proxy:setup` to reinstall
- In `json_utils.py`, add `_parse_with_repair(raw)` using `json_repair.repair_json()` as step 2 in each generation endpoint (after direct parse attempt, before LLM re-ask)

**Step 2.2 — system_prompt_style per backend:**
- Add `"system_prompt_style": "narrative"` to each backend dict in `config.py`
- `prompts.py` branches: `narrative` = current prompt style; `structured` = more explicit labeled sections (better for Qwen)
- Pass `backend.get("system_prompt_style", "narrative")` to prompt builder in `routes/chat.py`

**Critical import-order constraint:**
- `config.py` must NOT import from any other project module (it is the root)
- `models.py` must NOT import from any project module
- `json_utils.py` must NOT import from any project module
- `prompts.py` imports from `models.py` only
- `llm.py` imports from `config.py` (for `active_backend`, `_backend_lock`, `logger`)
- `routes/*` import from all of the above

---

### Phase 3 — Frontend features

Steps 3.1, 3.2, 3.3 are independent. Do 3.2 before 3.4. Do 3.5 before 4.2.

**3.1 — Markdown rendering**
- `npm install marked` (pin `^9.0.0`+)
- `chat.component.ts`: add `renderMarkdown(content: string): string` using `marked.parseSync()`
- Template: `[innerHTML]="renderMarkdown(msg.content)"` for assistant messages only — NOT for user messages
- **Streaming gotcha:** check `!(chatService.loading() && $last)` — render raw text while stream in progress, switch to rendered HTML on completion. Avoids broken-tag artifacts.
- Angular `[innerHTML]` sanitizer is safe. Do NOT use `bypassSecurityTrustHtml`.
- Add `.markdown-body` CSS: `p { margin: 0.4em 0 }`, `code { background: rgba(255,255,255,0.1) }`, `pre { overflow-x: auto }`

**3.2 — Stream cancellation**
- `chat.service.ts`:
  - Add `private _abortController: AbortController | null = null`
  - In `streamRequest`: `this._abortController = new AbortController()`, pass `signal: this._abortController.signal` to `fetch()`
  - In catch: distinguish `DOMException` with `name === 'AbortError'` — remove placeholder message (`this.messages.update(msgs => msgs.slice(0, -1))`)
  - Public `cancelStream()`: calls `this._abortController?.abort()`
  - In finally: `this._abortController = null`
- Template: ⏹ button visible when `chatService.loading()`

**3.3 — Chat persistence**
- `chat.service.ts`:
  - Persist messages to `localStorage` in the `finally` block of `streamRequest` (not per token)
  - Also persist on `resetMessages()`
  - Store scenario title alongside messages as identity check
  - `loadPersistedMessages()`: restore only if stored scenario title matches `scenarioService.activeScenario()?.title`
- `chat.component.ts` `ngOnInit`: call `this.chatService.loadPersistedMessages()` before `initializeStory()`

**3.4 — Regenerate last response** (do after 3.2)
- `chat.service.ts`: `regenerateLastResponse()` — find last assistant message index, slice it off, re-stream from trimmed history
- Guard: `if (this.loading()) return`
- Template: ♻️ button, disabled while `loading()`

**3.5 — Replace `confirm()` dialogs**
- `chat.component.ts`: `pendingAction = signal<'reset'|'new'|'change'|null>(null)`; methods `requestReset/New/Change()`, `confirmAction()`, `cancelAction()`
- Template: inline confirmation bar when `pendingAction()` non-null
- Three existing `confirm()` calls become request methods

---

### Phase 4 — Advanced features

**4.1 — Thinking mode toggle**
- `settings.service.ts`: `enableThinking = signal<boolean>(...)` persisted to localStorage
- Settings page: toggle UI
- `chat.service.ts`: include `enable_thinking: this.settingsService.enableThinking()` in payload
- Backend `ChatRequest`: add `enable_thinking: bool = False`
- Backend `_build_payload`: add `"thinking": {"type": "enabled", "budget_tokens": 1024}` when true
- **Gotcha:** verify exact llama.cpp API field — differs between model families and server versions
- Frontend: strip `<think>...</think>` blocks from rendered output or show in collapsible `<details>`

**4.2 — Context window warning + trim** (do after 3.5)
- `chat.service.ts`:
  - `estimatedTokens = computed(() => Math.round(totalChars / 4))`
  - `contextWarning = computed(() => this.estimatedTokens() > 3000)`
  - `contextCritical = computed(() => this.estimatedTokens() > 6000)`
  - `trimContext(keepLast = 10)`: slices messages signal, persists
- Template: warning banner with "Trim" button; use inline confirmation from 3.5

---

## Other things to keep in mind

- `LlmBackend` interface in `settings.service.ts` is missing `min_p?: number` and `system_prompt_style?: string` — update after Phase 2
- `PresetScenarioService` and preset picker are already done — don't redo
- `CLAUDE.md` at repo root exists and is accurate
- The `chat-template.md` in `.ai/` is the Gemma 4 Jinja2 template from HuggingFace — it's for reference only, `--jinja` means llama-server applies it server-side
