---
type: concept
tags: [llm, configuration, backend, design-decision]
sources: [plan-llmBackendSwitching.prompt.md, apps/llama-proxy/main.py, apps/llama-proxy/project.json]
updated: 2026-04-23
---

# LLM Backend Switching

The system supports multiple LLM backend profiles that can be switched at runtime without restarting.

## Backend profiles

Each profile has: `id`, `name`, `url`, `model`, and inference parameters (temperature, top_p, etc.). Defined as JSON in the `AVAILABLE_BACKENDS` env var, falling back to hardcoded defaults in `main.py`:

| ID | Model | Quant | Notes |
|----|-------|-------|-------|
| `gemma4-obliterated` | OBLITERATUS/gemma-4-E4B-it-OBLITERATED | Q8_0 | Default |
| `gemma4-uncensored` | HauhauCS/Gemma-4-E4B-Uncensored | Q6_K_P | Aggressive |

## Switching flow

1. Settings page loads → [[settings-service]] calls `GET /config/backends`
2. User selects a backend card → service calls `PATCH /config/backend`
3. Proxy updates its active backend in-memory
4. Service saves selection to localStorage for persistence across refresh
5. All subsequent `/chat`, `/generate-*` calls use the new backend

## Nx configuration

`dev:uncensored` npm script passes `--configuration=uncensored` to both `llama-proxy` and `llm` targets. Both now have `uncensored` configurations:

- `llm:serve:uncensored` → runs `start-llm.sh gemma4-uncensored`
- `llama-proxy:serve:uncensored` → starts uvicorn with `ACTIVE_BACKEND_ID=gemma4-uncensored`

**This was a bug fix made 2026-04-23**: `llama-proxy/project.json` was missing the `uncensored` configuration, causing `npm run dev:uncensored` to fail.

## Design rationale

Inference parameters differ per model: the uncensored model needs different temperature/top_p than the obliterated one. Baking them into the backend profile (rather than having a single global config) lets each model run with its optimal settings. See `project/raw/plan-llmBackendSwitching.prompt.md` for the original design spec.
