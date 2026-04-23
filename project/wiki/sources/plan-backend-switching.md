---
type: source-summary
tags: [plan, backend-switching, design-spec]
raw: project/raw/plan-llmBackendSwitching.prompt.md
ingested: 2026-04-23
---

# Source: LLM Backend Switching Plan

Summary of `project/raw/plan-llmBackendSwitching.prompt.md` — the design spec for runtime LLM backend selection.

## Core idea

Move from a single hardcoded llama-server URL to a profile system: multiple named backends, each with its own URL, model, and inference parameters. The user selects the active backend from a Settings page.

## Components specified

| What | Where | Notes |
|------|-------|-------|
| Backend profiles | `main.py` env var `AVAILABLE_BACKENDS` | JSON list |
| Active backend state | `ACTIVE_BACKEND_ID` env var + in-memory | Proxy owns this |
| Frontend persistence | localStorage in SettingsService | Survives refresh |
| Settings UI | `/settings` route | Backend cards + health status |
| Nx configs | `llm/project.json`, `llama-proxy/project.json` | `uncensored` configuration targets |

## Implementation status (as of 2026-04-23)

Fully implemented. Bug fixed: `llama-proxy/project.json` was missing the `uncensored` configuration — added 2026-04-23.

See → [[backend-switching]] for the implemented design.
