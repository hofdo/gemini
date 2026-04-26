# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Interactive RPG/storytelling platform. Three-tier architecture:

```
llama-chat (Angular 21, :4200)
    ↓ dev-proxy: /chat /assist /generate-* /config /health
llama-proxy (FastAPI, :8000)
    ↓ httpx streaming
llm (llama-server / llama.cpp, :8080)
```

Two LLM backends configured: `gemma4-obliterated` (Q8_0) and `gemma4-uncensored` (Q6_K_P). Active backend toggled at runtime via `PATCH /config/backend` or env vars.

## Commands

```bash
# Start everything
npm run dev                        # obliterated model (default)
npm run dev:uncensored             # uncensored model variant

# Individual services
npx nx serve llama-chat            # Angular dev server (:4200)
npx nx serve llama-proxy           # FastAPI (:8000)
npx nx serve llm                   # llama-server (:8080)
npx nx serve llm --configuration=uncensored

# Build / lint / test
npx nx run-many -t lint test build e2e
npx nx test llama-chat             # single project
npx nx e2e llama-chat-e2e
npx nx run llama-proxy:lint        # Ruff
npx nx run llama-proxy:setup       # create .venv + pip install
```

## Frontend Architecture (`apps/llama-chat`)

All components are **standalone** (no NgModules). State via **Angular signals** (`signal()`, `.set()`, `.update()`). Routes lazy-load components.

**Routes**: `/ → MenuComponent` → `scenario/:mode → ScenarioFormComponent` → `/chat → ChatComponent` or `/dm → DmComponent` → `/settings → SettingsComponent`

**Key services** (all `providedIn: 'root'`):

| Service | Responsibility |
|---|---|
| `ChatService` | Streaming SSE chat via `fetch` + `ReadableStream`; holds `messages` signal |
| `AiAssistService` | Calls `/assist`, `/generate-scenario`, `/generate-npc`, `/generate-quest` |
| `ScenarioService` | Holds `activeScenario` signal; persists to `sessionStorage` |
| `SettingsService` | Loads backend list from `/config/backends`; syncs active backend to proxy + `localStorage` |

**Core models** (`scenario/scenario.model.ts`):
- `ScenarioType`: `'adventure' | 'interpersonal'`
- `InputType`: `'dialogue' | 'action' | 'direct'` — tagged on each chat message
- `Scenario`, `Npc`, `NpcStats` — scenario config passed to every LLM call

## Backend Architecture (`apps/llama-proxy/main.py`)

Single-file FastAPI app. All logic in `main.py`.

**Endpoints:**

| Endpoint | What it does |
|---|---|
| `POST /chat` | Streaming SSE; passes full message history + scenario as system prompt to llama-server |
| `POST /assist` | Suggest/rewrite user input given conversation context |
| `POST /generate-scenario` | LLM-generates a full `Scenario` JSON |
| `POST /generate-npc` | LLM-generates NPC with stats |
| `POST /generate-quest` | LLM-generates a `Quest` with encounters/rewards |
| `GET /health` | Proxy + LLM reachability check |
| `GET /config/backends` | List configured backends |
| `PATCH /config/backend` | Switch active backend (mutates global `active_backend`) |

**Backend config** overridable via env vars:
- `AVAILABLE_BACKENDS` — JSON array of backend objects
- `ACTIVE_BACKEND_ID` — default active backend id
- `LLAMA_CPP_URL` — llama-server URL (default `http://localhost:8080`)

## Nx Workspace

- Package manager: `npm` — prefix Nx commands with `npx nx`
- Tags: `scope:backend lang:python` (llama-proxy), `scope:infra` (llm)
- Python `.venv` lives at `apps/llama-proxy/.venv` — must run `setup` target before first use
- E2E: Playwright (`apps/llama-chat-e2e`)
- Linting: ESLint 9 (Angular), Ruff (Python)

## Wiki / Docs System

See `.claude/CLAUDE.md` for the LLM wiki schema (`docs/wiki/`) and context navigation protocol. Check `docs/wiki/index.md` before reading raw source files.