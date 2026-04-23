---
type: entity
tags: [frontend, angular, service, settings, backend-switching]
sources: [apps/llama-chat/src/app/shared/settings.service.ts, plan-llmBackendSwitching.prompt.md]
updated: 2026-04-23
---

# SettingsService

Located at `apps/llama-chat/src/app/shared/settings.service.ts`. Shared Angular service for backend configuration.

## Responsibilities

- Fetches available backends from `GET /config/backends`
- Persists the selected backend to **localStorage** (so selection survives page refresh)
- Sends `PATCH /config/backend` to switch the active backend on the proxy
- Exposes current backend state to any component that injects it

## Consumers

- **SettingsComponent** (`/settings` route) — displays backend cards, calls health check
- **ChatComponent** — reads current backend to show in header

## Design rationale (from plan file)

localStorage was chosen for frontend persistence so the user's backend choice survives navigation and refresh without needing a server-side session. The proxy maintains its own `ACTIVE_BACKEND_ID` state — localStorage keeps the UI in sync.

See → [[backend-switching]] for the full switching flow.
