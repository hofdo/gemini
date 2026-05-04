# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Interactive RPG/storytelling platform. Three-tier architecture:

```
story-companion (Angular 21, :4300)
    ↓ dev-proxy: /chat /assist /generate-* /config /health
llama-proxy-ts (Fastify + Zod, :8000)
    ↓ OpenAI-compatible HTTP
llm (llama-server / llama.cpp, :8080)
```

Two LLM backends configured: `gemma4-uncensored` (Q6_K_P) and `qwen3-uncensored` (Q8_0). Active backend toggled at runtime via `PATCH /config/backend` or env vars.

## Commands

```bash
# Start everything
npm run dev                        # story-companion + proxy-ts + llm
npm run dev:qwen3                  # same stack with qwen3 llm config

# Individual services
npx nx serve story-companion       # Angular dev server (:4300)
npx nx serve llama-proxy-ts        # TypeScript Fastify proxy (:8000)
npx nx serve llm                   # llama-server (:8080)
npx nx serve llm --configuration=qwen3-uncensored

# Build / lint / test
npx nx run-many -t lint test build e2e
npx nx test story-companion        # frontend app
npx nx run llama-proxy-ts:test     # TS backend tests
```

## Frontend Architecture (`apps/story-companion`)

All components are **standalone**. The frontend is organized around a scenario wizard and a workspace view, with state handled via Angular signals and focused services under `apps/story-companion/src/app/core`.

**Routes**: `/ → ScenarioWizardComponent` → `/workspace/:id → StoryWorkspaceComponent`

**Key frontend services**:

| Service | Responsibility |
|---|---|
| `StorySessionService` | Session lifecycle, persistence, streaming message flow, and provider orchestration |
| `LocalStoryProvider` | Calls proxy-ts endpoints for chat, world-state, oracle, and scenario generation |
| `AdventureAssistService` | Suggests or rewrites player input from current scenario/session context |
| `ChatRenderingService` | Renders assistant markdown safely for the workspace |

## Backend Architecture (`apps/llama-proxy-ts`)

Default local proxy is TypeScript/Fastify with Zod shared contracts in
`libs/shared/api-contracts`. It proxies local OpenAI-compatible llama.cpp
endpoints, supports streaming `/chat`, structured JSON generation, and provider
health/config endpoints. Puter/Grok cloud mode remains frontend-side.

## Nx Workspace

- Package manager: `npm` — prefix Nx commands with `npx nx`
- Main active projects: `story-companion`, `story-companion-e2e`, `llama-proxy-ts`, `llm`
- Tags: `scope:app` / `lang:angular` for frontend, `scope:backend` / `lang:typescript` for proxy, `scope:infra` for llm
- E2E: Playwright (`apps/story-companion-e2e`)
- Linting: ESLint 9

## Wiki / Docs System

See `.claude/CLAUDE.md` for the LLM wiki schema (`docs/wiki/`) and context navigation protocol. Check `docs/wiki/index.md` before reading raw source files.
