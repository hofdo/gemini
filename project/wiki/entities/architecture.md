---
type: entity
tags: [architecture, system-design, core]
sources: [CLAUDE.md, plan-llmBackendSwitching.prompt.md]
updated: 2026-04-23
---

# Three-Tier Architecture

The platform is a three-layer stack where each tier has a single responsibility:

```
llama-chat (Angular 21, :4200)
    ↓ proxies /chat, /assist, /generate-*, /config, /health
llama-proxy (FastAPI, :8000)
    ↓ orchestrates LLM calls, manages backends
llm (llama-server / llama.cpp, :8080)
```

## Tier 1 — llama-chat (Frontend)

Angular 21 standalone-component SPA. Owns all UI concerns: chat interface, scenario builder, DM mode, settings. Delegates all AI work to the proxy via HTTP. Configured via `proxy.conf.json` to forward `/chat`, `/assist`, `/generate-*`, `/config`, `/health` to port 8000.

Key modules: `chat/`, `scenario/`, `dm/`, `menu/`, `settings/`, `shared/`.

## Tier 2 — llama-proxy (Backend)

Single-file FastAPI app (`apps/llama-proxy/main.py`). Translates Angular HTTP requests into llama.cpp `/completion` calls. Handles prompt engineering (builds system prompts, kickoff prompts, interpersonal prompts). Manages backend switching via env vars.

See → [[llama-proxy]] for full endpoint table.

## Tier 3 — llm (llama-server)

Shell-script-based Nx project. Launches llama-server with a Gemma-4 model from HuggingFace via `-hf`. Uses `-ngl 99` for Apple Metal GPU acceleration (M-series). Two model variants: obliterated (Q8_0) and uncensored (Q6_K_P).

## Data Flow

1. User types in Angular chat UI
2. Angular POSTs to `/chat` (proxied to :8000)
3. llama-proxy builds the prompt, POSTs to llama-server `/completion`
4. Response streams back through proxy → Angular
5. Angular renders the streamed tokens

## Key Design Decision

The proxy is the sole orchestrator — the frontend never talks to llama-server directly. This lets the proxy swap backends (obliterated vs uncensored) without the frontend knowing, and keeps prompt engineering in one place.
