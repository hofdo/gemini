# Wiki Log

_Append-only. Format: `## [YYYY-MM-DD] operation | description`_

---

## [2026-04-23] setup | Second brain initialized

Set up wiki structure. Created `project/` with `raw/`, `wiki/` (entities, concepts, sources), and `graphify-out/` placeholder.

Moved from repo root to `project/raw/`:
- `plan-llmBackendSwitching.prompt.md`
- `plan-dungeonMasterMode.prompt.md`

Initial wiki pages written from graphify run (270 nodes, 346 edges):
- Entities: architecture, llama-proxy, dm-component, ai-assist-service, settings-service
- Concepts: backend-switching, dm-mode, npc-duplication
- Sources: plan-backend-switching, plan-dm-mode

CLAUDE.md rewritten as full second-brain schema.

---

## [2026-04-23] fix | dev:uncensored npm script

- Root cause: `llama-proxy/project.json` missing `uncensored` configuration for `serve` target
- Fix: Added `configurations.uncensored` with `ACTIVE_BACKEND_ID=gemma4-uncensored`
- Bonus: Cleared stale `.nx/workspace-data` cache referencing deleted `apps/nx-monorepo-experiment-e2e`

---
