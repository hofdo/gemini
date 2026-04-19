# Plan: Add `llama-chat` Angular App + `llama-proxy` FastAPI App

Both apps are added to `apps/` in the existing Nx 22.5.2 / Angular 21 monorepo. The Angular app is generated via Nx CLI (inheriting existing generator defaults), then manually extended with a chat component and HTTP service. The Python app is fully hand-crafted with a `project.json` that exposes `serve` and `lint` targets to Nx without any Python plugin. A dev-server proxy config routes Angular's `/chat` calls to FastAPI to avoid CORS friction in development.

---

## Steps

### 1 — Generate the Angular `llama-chat` app

Run from the workspace root:
```
npx nx g @nx/angular:app llama-chat --directory=apps/llama-chat --prefix=llama --standalone --routing=false
```
This reuses the existing `nx.json` generator defaults (SCSS, Jest, Playwright, ESLint flat config) and produces `apps/llama-chat/` with the standard Angular Nx layout.

---

### 2 — Add `HttpClient` and signals-based chat service

- In `apps/llama-chat/src/app/app.config.ts`, add `provideHttpClient()` to the `providers` array.
- Create `apps/llama-chat/src/app/chat/chat.service.ts` — injectable service with:
  - A `messages` signal (`signal<{role,content}[]>([])`)
  - A `sendMessage(content: string)` method that POSTs `{ messages }` to `/chat` via `HttpClient` and appends the response to the signal
- Return type from backend: `{ reply: string }` (simple, non-streaming to start)

---

### 3 — Scaffold the `ChatComponent`

- Create `apps/llama-chat/src/app/chat/chat.component.ts` as a standalone component (signals-based, no `ngModel`, use `FormsModule` for the input)
- Template (`chat.component.html`) renders:
  - A scrollable message list bound to `chatService.messages()`
  - A `<textarea>` + Send button that calls `chatService.sendMessage()`
- Style (`chat.component.scss`) — minimal flex-column layout
- Register the component in `apps/llama-chat/src/app/app.ts` (the root standalone component), replacing the `nx-welcome` placeholder

---

### 4 — Configure the Angular dev-server proxy

Create `apps/llama-chat/proxy.conf.json`:
```json
{ "/chat": { "target": "http://localhost:8000", "secure": false } }
```
In `apps/llama-chat/project.json`, add `"proxyConfig": "apps/llama-chat/proxy.conf.json"` to the `serve → development` build target options. This eliminates CORS issues during local development.

---

### 5 — Create the `llama-proxy` Python app folder structure

Manually create `apps/llama-proxy/` with:
```
apps/llama-proxy/
├── project.json        ← Nx project descriptor
├── pyproject.toml      ← dependencies + ruff config
├── main.py             ← FastAPI app entry point
└── .python-version     ← (optional) e.g. "3.12"
```

**`pyproject.toml`** declares:
- `[project]` with `dependencies = ["fastapi", "uvicorn[standard]", "httpx"]`
- `[tool.ruff]` with basic lint rules
- `[build-system]` using `hatchling` (or left minimal)

**`main.py`** structure:
- `FastAPI()` instance with `CORSMiddleware` (origins `["http://localhost:4200"]`)
- `POST /chat` endpoint accepting `{ messages: list[dict] }`
- Forwards to `http://localhost:8080/v1/chat/completions` via `httpx.AsyncClient`
- Returns `{ reply: str }` from the first choice's message content

---

### 6 — Write `apps/llama-proxy/project.json`

Mirror the structure of `apps/nx-monorepo-experiment/project.json` but use `nx:run-commands` executors:
```json
{
  "name": "llama-proxy",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "apps/llama-proxy",
  "tags": ["scope:backend", "lang:python"],
  "targets": {
    "serve": {
      "continuous": true,
      "executor": "nx:run-commands",
      "options": {
        "command": "uvicorn main:app --reload --port 8000",
        "cwd": "apps/llama-proxy"
      }
    },
    "lint": {
      "executor": "nx:run-commands",
      "options": {
        "command": "ruff check .",
        "cwd": "apps/llama-proxy"
      }
    }
  }
}
```

---

### 7 — Run both apps together with Nx

Add a `run-many` convenience entry to `nx.json`'s `targetDefaults` or simply use:
```
npx nx run-many -t serve -p llama-chat llama-proxy --parallel
```
Or define a `serve-all` target in `nx.json` using `nx:run-commands` with multiple commands, for a single `npx nx serve-all` invocation.

---

## Further Considerations

1. **Streaming vs. simple response** — The plan uses a one-shot `{ reply }` response for simplicity. If streaming (SSE/chunked) is preferred, `main.py` would use `StreamingResponse` and the Angular service would switch from `HttpClient.post` to `EventSource` — worth deciding before implementing.
2. **Python environment management** — The plan assumes `uvicorn` and `ruff` are available on `PATH` (e.g. via a `venv` or global install). Consider adding a `setup` target to `project.json` that runs `pip install -e .` or `uv sync` to make onboarding reproducible.
3. **E2E app for `llama-chat`** — The Nx generator will also create `apps/llama-chat-e2e/` (Playwright). Verify the generated `playwright.config.ts` points to `http://localhost:4200` (the default) and matches the port in `proxy.conf.json`.

