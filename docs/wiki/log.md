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

## [2026-04-24] graphify | Second run — wiki integrated into graph

Re-ran `/graphify .` on full repo including the newly created `project/wiki/` pages.

Key changes from run 1 → run 2:
- 270 → 289 nodes (+19), 346 → 358 edges (+12), 38 → 55 communities
- Wiki pages now structurally integrated: `Wiki Index` is the **4th god node** (11 edges)
- `LLM Backend Switching` concept page has 9 edges — docs layer has structural weight
- New hyperedges found: Chat Send Flow, Scenario→Chat Bridge, DM NPC Generation Flow

Path correction: graphify always outputs to `./graphify-out/` at repo root (not `project/graphify-out/`). Fixed in CLAUDE.md and index.md.

Notable graph insight: `Backend Parameter Grid` ↔ `DM NPC Stats Grid` flagged AMBIGUOUS — the settings inference param grid (temperature/top_p) and the NPC ability score grid (STR/DEX) are both parameter grids but solve unrelated problems. The AMBIGUOUS tag is correct.

---

## [2026-04-25] refactor | Rename project/ → docs/, consolidate .ai/ plan files

Resolved structural contradiction between the Nx monorepo mental model (where "project" means a buildable unit) and the second-brain folder named `project/`. Renamed `project/` → `docs/` via `git mv` to preserve history. Removed the empty `docs/graphify-out/` placeholder (graphify always outputs to repo root). Moved 6 orphaned plan files from `.ai/` into `docs/raw/` so all raw source materials are in one place. Updated all forward-looking path references in `.claude/CLAUDE.md`, `docs/wiki/index.md`, both source summaries, and two entity/concept pages. Historical log entries left unchanged. Six newly consolidated plans added to `docs/wiki/index.md` with status "Not yet ingested".

---
