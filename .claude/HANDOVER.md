# Session Handover — World State Feature

## What this project is

Interactive RPG/storytelling platform. Three-tier:
```
llama-chat (Angular 21, :4200)
    ↓ /chat /assist /generate-* /config /health
llama-proxy (FastAPI, :8000)
    ↓ httpx streaming
llm (llama.cpp, :8080)
```

Two LLM backends: `gemma4-obliterated` (default) and `gemma4-uncensored`.
`npm run dev` starts everything.

---

## What was built this session

### Phase 1 — World State data model (commit `77f6f62`)

**New files:**
- `apps/llama-chat/src/app/world-state/world-state.model.ts` — full TypeScript type hierarchy
- `apps/llama-chat/src/app/world-state/world-state.service.ts` — Angular service with persistence

**Modified:**
- `apps/llama-proxy/models.py` — 12 new Pydantic models appended at end

Key design decisions baked in:
- `effect()` as single localStorage write path (async); `applyDelta()` also writes synchronously
- Storage key: `llama-world-state-{WorldState.id}` (UUID, not title)
- `storyEvents` capped at 50 hot events; overflow → `archivedEventCount` counter
- `_schemaVersion: 1` + `migrate()` runner for future field additions
- `toCompactPrompt(maxBudget=600)` — token-budgeted string, always use this for LLM injection, never raw state
- `detectContradictions(text)` — scans narrative for dead NPC names

### Phase 2 — World state in system prompt (commit `f11689a`)

**Modified:**
- `apps/llama-proxy/prompts.py` — full rewrite: added `standing_label()`, `_build_world_state_block()`, both `build_system_prompt()` and `build_interpersonal_system_prompt()` now accept optional `world_state`
- `apps/llama-proxy/models.py` — `ChatRequest` gains `world_state: WorldStateModel | None = None`
- `apps/llama-proxy/routes/chat.py` — both build_* calls now pass `request.world_state`
- `apps/llama-chat/src/app/chat/chat.service.ts` — `WorldStateService` injected, `world_state` added to all 3 request payloads

What the world state block renders (when non-null):
1. Ground-truth anchor: "AUTHORITATIVE — DO NOT CONTRADICT"
2. Current scene (location, tension, present NPCs, world clock)
3. Active NPCs with `standing_label()` disposition, NPC-NPC relationships
4. Factions with standing label + number (non-zero only)
5. Recent events (last 3, certainty-qualified: witnessed/rumored/deduced; `false` omitted)
6. Canon facts (max 10)
7. Deceased block (dead NPCs separated, explicit "do not include in scenes")

---

## Current gap: WorldState is never initialized

`WorldStateService.state()` is always `null` until someone calls `initForScenario(scenario)`.
The `ChatComponent` does NOT call this yet. So world_state sends as `null` in every request.
**Nothing is broken** — `null` world_state = no block added to prompt = backward compatible.

---

## What comes next (from the plan)

Plans live in `.claude/plans/`:
- `adventure-world-state-roadmap.md` — full 6-phase roadmap
- `storage-analysis.md` — storage decisions (localStorage, keys, schema versioning)

### Next priority: Phase 4 — World State UI

Build before Phase 3 (LLM delta updates) so you can see/verify what the LLM would track.

Collapsible side panel in `ChatComponent`. Tabs: Scene, Factions, NPCs, Events.
Also needs: `ChatComponent.ngOnInit()` to call `worldStateService.loadForScenario(scenario.title)` or `initForScenario(scenario)`.

### After that: Phase 3 — LLM delta updates

New endpoint `POST /world-state/update` in `apps/llama-proxy/routes/generate.py`.
Request: `{ scenario, world_state, last_exchanges: last 6 messages }`.
Response: `WorldStateDelta` with faction/NPC/scene/event changes.
Frontend: fire-and-forget after stream completes in `ChatService.sendMessage()`.

Critical prompt engineering for this endpoint (from expert review):
- Inject compact ID-to-name table so LLM uses real IDs, not invented ones
- Explicit rules: only mark dead if explicitly stated, delta cap ±25, max 2 key facts/turn
- Temperature 0.1–0.2 (deterministic extraction)

### Remaining: Phase 5 (DM integration), Phase 6 (session compression) — lower priority

---

## Key files to know

| Path | What it is |
|---|---|
| `apps/llama-chat/src/app/world-state/world-state.model.ts` | All TS types |
| `apps/llama-chat/src/app/world-state/world-state.service.ts` | State service |
| `apps/llama-chat/src/app/chat/chat.service.ts` | Chat streaming, now injects WorldStateService |
| `apps/llama-proxy/prompts.py` | System prompt builders (now world-state aware) |
| `apps/llama-proxy/models.py` | All Pydantic models (WorldStateModel at line ~165) |
| `apps/llama-proxy/routes/chat.py` | /chat endpoint (passes world_state to prompts) |
| `.claude/plans/adventure-world-state-roadmap.md` | Full 6-phase plan with all specs |
| `.claude/plans/storage-analysis.md` | Storage decisions and guardrails |

## Tests

Run: `npx nx test llama-chat`
9 tests, all pass. Located in:
- `apps/llama-chat/src/app/app.spec.ts`
- `apps/llama-chat/src/app/chat/chat.service.spec.ts`

No tests yet for `WorldStateService` — that's a gap to fill in Phase 4 or alongside.

## Gotchas

- `llama-proxy` uses `.venv` at `apps/llama-proxy/.venv` — run `npx nx run llama-proxy:setup` first time
- `WorldStateModel` in `prompts.py` imported under `TYPE_CHECKING` guard to avoid circular import at runtime
- `standing_label()` is defined in `prompts.py` (backend) AND mirrored as a module-scope function in `world-state.service.ts` (frontend) — keep them in sync if thresholds change
- `ChatRequest.world_state` uses forward-reference string `"WorldStateModel | None"` in models.py because `WorldStateModel` is defined after `ChatRequest` in that file
