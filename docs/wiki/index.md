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
| [[sources/plan-backend-switching]] | `docs/raw/plan-llmBackendSwitching.prompt.md` | Fully implemented |
| [[sources/plan-dm-mode]] | `docs/raw/plan-dungeonMasterMode.prompt.md` | Fully implemented |
| — | `docs/raw/plan-llamaChatAndProxy.prompt.md` | Not yet ingested |
| — | `docs/raw/plan-llamaChatStoryMode.prompt.md` | Not yet ingested |
| — | `docs/raw/plan-streamingLlmResponses.prompt.md` | Not yet ingested |
| — | `docs/raw/plan-interpersonalScenarioType.prompt.md` | Not yet ingested |
| — | `docs/raw/plan-autoStartStoryIntro.prompt.md` | Not yet ingested |
| — | `docs/raw/plan-aiAssistedInputAndScenarioGeneration.prompt.md` | Not yet ingested |

## Knowledge graph

oThe graphify knowledge graph lives in `graphify-out/` at the **repo root** (graphify always outputs there). Re-run `/graphify .` to rebuild. Query with `/graphify query "..."`.

Key stats from last run (2026-04-24): 289 nodes, 358 edges, 55 communities.
God nodes: DmComponent (48), ScenarioFormComponent (26), ChatComponent (13), **Wiki Index (11)**, llama-proxy (10).
