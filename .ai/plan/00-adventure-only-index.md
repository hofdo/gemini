# Adventure-Only Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the new `story-companion` + `llama-proxy-ts` stack into an adventure-only RPG companion while preserving the new session/provider architecture.

**Architecture:** Use the legacy `llama-chat` and `llama-proxy` implementation as a reference, but implement new behavior in `story-companion`, `llama-proxy-ts`, and shared libraries used by that stack. Preserve IndexedDB sessions, provider switching, TypeScript proxy contracts, and the local/Puter provider abstraction.

**Tech Stack:** Angular 21 standalone components, Angular signals, Fastify, Zod shared contracts, Jest, Nx.

---

## Execution Order

Implement these files in order. Each phase should leave the app in a working state.

1. `.ai/plan/01-adventure-only-foundation.md`
2. `.ai/plan/02-core-adventure-chat-parity.md`
3. `.ai/plan/03-adventure-scenario-tooling.md`
4. `.ai/plan/04-living-world-adventure-systems.md`
5. `.ai/plan/05-dm-journal-combat.md`

## Shared Constraints

- Target the new stack unless a task explicitly says otherwise:
  - `apps/story-companion`
  - `apps/llama-proxy-ts`
  - `libs/shared/api-contracts`
  - shared libraries consumed by `story-companion`
- Use legacy `apps/llama-chat`, `apps/llama-proxy`, and legacy feature libs as references only unless a phase explicitly says to modify shared code.
- Preserve IndexedDB session persistence in `StorySessionRepository`.
- Preserve provider mode support: local TS proxy and Puter/Grok.
- Keep adventure input modes:
  - `dialogue`
  - `action`
  - `direct`
  - `remember`
- Treat `dialogue` as adventure NPC speech, not interpersonal mode.
- Do not remove or rewrite the legacy app.
- Do not add a migration that deletes existing browser data without a user-visible fallback.
- Add failing tests before behavior changes.

## Product Definition

Adventure-only means:

- Users create and play adventure scenarios.
- NPCs, factions, quests, combat, journal, oracle, and living world are in scope.
- Interpersonal/partner scenario generation is out of scope.
- Partner fields and bond mechanics are compatibility-only until intentionally removed.

## Global Do Not List

- Do not reintroduce `interpersonal` as a selectable scenario type in `story-companion`.
- Do not port bond state, partner profile UI, partner relationship UI, or romance-specific prompt branches.
- Do not replace the new app's IndexedDB session model with the legacy single localStorage message store.
- Do not make the Python proxy required for the new app.
- Do not silently mutate or delete user sessions.
- Do not couple combat state directly into message rendering.
- Do not add broad refactors outside the active phase.

## Verification Commands

Run the relevant commands for every phase.

```bash
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

If a phase modifies shared contracts, also run tests for any affected shared libraries:

```bash
npx nx test shared-api-contracts --runInBand --skip-nx-cache
```

If the project name differs, discover it with:

```bash
npx nx show projects | rg "api|contract|story|proxy"
```

## Commit Guidance

Use one commit per phase when possible. If a phase is large, use one commit per completed task group.

Suggested commit subjects:

```bash
git commit -m "feat(story): make new app adventure only"
git commit -m "feat(story): restore core adventure chat controls"
git commit -m "feat(story): add adventure scenario tooling"
git commit -m "feat(story): expand living world state"
git commit -m "feat(story): add dm journal combat tools"
```
