---
type: entity
tags: [frontend, angular, service, ai, bridge]
sources: [ai-assist.service.ts]
updated: 2026-04-23
---

# AiAssistService

Located at `apps/llama-chat/src/app/shared/` (or similar). The single HTTP client for all AI generation calls from the Angular frontend.

**Graph role: bridge node between two communities** — AI Assist Service (community 7) and AI Content Generation (community 3). High betweenness centrality (0.042).

## Methods

| Method | Endpoint called | Used by |
|--------|----------------|---------|
| `callAssist()` | `POST /assist` | ChatComponent (suggest/rewrite button) |
| `generateScenario()` | `POST /generate-scenario` | ScenarioFormComponent |
| `generateNpc()` | `POST /generate-npc` | DmComponent, ScenarioFormComponent |
| `generateQuest()` | `POST /generate-quest` | DmComponent |
| `rewriteInput()` | `POST /assist` | ChatComponent |

## Why this matters

Any change to the proxy API (request/response shape, new parameters) must be reflected here. It's the chokepoint between the Angular app and the llama-proxy backend.

## Connections

- Consumed by [[dm-component]], [[scenario-form]], ChatComponent
- Calls → [[llama-proxy]] endpoints
