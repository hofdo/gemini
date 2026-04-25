---
type: entity
tags: [backend, fastapi, python, core]
sources: [apps/llama-proxy/main.py, CLAUDE.md]
updated: 2026-04-23
graph_node_id: entity_llama_proxy
---

# llama-proxy

Single-file FastAPI backend at `apps/llama-proxy/main.py`. The middle tier of the [[architecture]].

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/chat` | Story responses, streaming supported |
| POST | `/assist` | AI suggestions / input rewriting for player |
| POST | `/generate-scenario` | Adventure or interpersonal scenario |
| POST | `/generate-npc` | D&D 2024 NPC with full stat block |
| POST | `/generate-quest` | Quest with encounters table |
| GET | `/config/backends` | List available LLM backends |
| PATCH | `/config/backend` | Switch active backend |
| GET | `/health` | Health check (used by Settings page) |

## Prompt engineering

Three system prompt builders live here:
- `build_system_prompt()` — general story GM
- `build_interpersonal_system_prompt()` — interpersonal scenario GM
- `build_kickoff_prompt()` — story initialization

`_extract_json_object()` — utility (7 edges, god-node adjacent) that strips markdown fences and finds valid JSON in LLM output. Critical for structured generation endpoints.

## Backend switching

Controlled by two env vars:
- `AVAILABLE_BACKENDS` — JSON list of backend profiles (id, name, url, model, inference params)
- `ACTIVE_BACKEND_ID` — which backend is active (defaults to first)

See → [[backend-switching]] for the full design.

## Running

```bash
npx nx serve llama-proxy             # default (obliterated model)
npx nx serve llama-proxy --configuration=uncensored  # uncensored model
```

Starts uvicorn on port 8000 with `--reload`.
