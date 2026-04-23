# Plan: LLM Backend Switching + llama.cpp Model Startup

The proxy already reads `LLAMA_CPP_URL` from env and sends `"local-model"` as the model name in every request. The plan adds a persisted backend-profile system (URL + model name + inference parameters per backend), exposes a config API on the proxy, wires a Settings page in Angular, and adds llama.cpp startup scripts with an Nx target so the LLM can be launched with a single command.

## Supported Models

Two HuggingFace-hosted Gemma-4 variants via `llama-server -hf`:

| ID | HuggingFace repo | Quant | Notes |
|----|-----------------|-------|-------|
| `gemma4-uncensored` | `HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive` | `Q6_K_P` | Uncensored, aggressive creative output |
| `gemma4-obliterated` | `OBLITERATUS/gemma-4-E4B-it-OBLITERATED` | `Q8_0` | Instruction-tuned, use tuned inference params |

Optimal inference parameters for `gemma4-obliterated`:

```
temperature:    0.7
top_p:          0.9
top_k:          40
repeat_penalty: 1.1
```

## Steps

1. **Extend [`main.py`](apps/llama-proxy/main.py)**:
   - Replace the module-level `LLAMA_CPP_URL` constant with an in-memory `active_backend` dict holding `{id, name, url, model, temperature, top_p, top_k, repeat_penalty}`.
   - Define a `BACKENDS` list from an `AVAILABLE_BACKENDS` env var (JSON) with the two Gemma models as defaults, each carrying their own inference parameters.
   - Thread the active backend's parameters into every `call_llm` and `stream_chat` payload (`temperature`, `top_p`, `top_k`, `repeat_penalty`).
   - Add `GET /config/backends` (list all backends + active id) and `PATCH /config/backend` (switch active by id) endpoints.

2. **Add [`scripts/start-llm.sh`](scripts/start-llm.sh)** — a bash script that accepts a model id argument (`gemma4-uncensored` or `gemma4-obliterated`, defaulting to the obliterated one) and runs the matching `llama-server -hf <repo>:<quant>` command with `--port 8080`. Reads an optional `HF_TOKEN` env var for HuggingFace authentication. Includes a GPU-offload flag (`-ngl 99`) which is a no-op when no GPU is present but accelerates inference on Metal/CUDA.

3. **Add [`apps/llm/project.json`](apps/llm/project.json)** with an Nx `start` target that calls `scripts/start-llm.sh` via `nx:run-commands`, so `npx nx start llm` (optionally `-- --model=gemma4-uncensored`) starts the server.

4. **Add [`apps/llama-proxy/.env.example`](apps/llama-proxy/.env.example)** documenting:
   - `LLAMA_CPP_URL` (default `http://localhost:8080`)
   - `ACTIVE_BACKEND_ID` (default `gemma4-obliterated`)
   - `AVAILABLE_BACKENDS` (JSON array override to add custom endpoints)
   - `HF_TOKEN` (HuggingFace token for private/gated model downloads)

5. **Create `SettingsService`** in `apps/llama-chat/src/app/shared/` that:
   - Calls `GET /config/backends` on init to load all backend profiles and the active id.
   - Calls `PATCH /config/backend` when the user picks a different backend.
   - Persists the last chosen backend id to `localStorage` to pre-select on page refresh.

6. **Create `SettingsComponent`** at `/settings` — displays each backend as a selectable card showing name, URL, model, and inference parameter chips. The active card is highlighted. A live indicator pings `GET /health` on the proxy to confirm connectivity.

7. **Update [`app.routes.ts`](apps/llama-chat/src/app/app.routes.ts) and [`menu.component.html`](apps/llama-chat/src/app/menu/menu.component.html)** to add the `/settings` route and a ⚙️ settings icon-button in the menu header.

## Further Considerations

1. **Inference parameters per endpoint**: The `gemma4-uncensored` model uses llama.cpp defaults (temperature 0.8, etc.) while `gemma4-obliterated` uses the tuned values above. Each backend profile in `AVAILABLE_BACKENDS` carries its own parameter set so they are applied automatically when the backend is switched.
2. **HuggingFace model download**: `llama-server -hf` downloads the GGUF on first run into `~/.cache/llama.cpp/`. Subsequent starts are instant. A `HF_TOKEN` env var is required if the repo is gated.
3. **Settings persistence scope**: Active backend choice is per-browser (localStorage) on the Angular side and in-memory on the proxy side. The proxy also reads `ACTIVE_BACKEND_ID` from env on startup as the default, so the server always starts deterministically.
4. **GPU acceleration**: Running on macOS with Apple M5 — Metal GPU acceleration is natively supported by llama.cpp. `scripts/start-llm.sh` passes `-ngl 99` to offload all layers to the GPU, maximising inference speed on the M5's Neural Engine / GPU cores.

