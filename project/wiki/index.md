# Wiki Index

_LLM-maintained. Updated on every ingest and after significant queries._

## Entities — components, services, systems

| Page | Summary |
|------|---------|
| [[entities/architecture]] | Three-tier stack: Angular → FastAPI → llama-server |
| [[entities/llama-proxy]] | FastAPI backend — all endpoints, prompt engineering, backend switching |
| [[entities/dm-component]] | God node (48 edges) — DM quest+NPC creator, splitting candidate |
| [[entities/ai-assist-service]] | Bridge service — single HTTP client for all AI generation calls |
| [[entities/settings-service]] | Backend config service — localStorage persistence + proxy PATCH |

## Concepts — patterns, decisions, issues

| Page | Summary |
|------|---------|
| [[concepts/backend-switching]] | Runtime LLM backend selection — profiles, env vars, Nx configs |
| [[concepts/dm-mode]] | Dungeon Master toolset — standalone quest/NPC prep, not chat |
| [[concepts/npc-duplication]] | Two NPC creation flows (DM mode + scenario form) — refactoring opportunity |

## Sources — summaries of raw documents

| Page | Raw file | Status |
|------|----------|--------|
| [[sources/plan-backend-switching]] | `project/raw/plan-llmBackendSwitching.prompt.md` | Fully implemented |
| [[sources/plan-dm-mode]] | `project/raw/plan-dungeonMasterMode.prompt.md` | Fully implemented |

## Knowledge graph

The graphify knowledge graph lives in `project/graphify-out/`. Re-run `/graphify .` to rebuild after significant code changes. Query it with `/graphify query "..."`.

Key stats from last run (2026-04-23): 270 nodes, 346 edges, 38 communities.
