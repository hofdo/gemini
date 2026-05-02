# Living World Adventure Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand new-app world state from key facts into a living adventure state with scenes, factions, NPCs, quests, events, clock, ambient injects, rumors, drift, and summaries.

**Architecture:** Keep world state stored inside each `StorySession`. Apply server-extracted deltas in `StorySessionService` through pure helper functions that can be unit tested without Angular rendering.

**Tech Stack:** Angular signals, IndexedDB, Zod contracts, Fastify JSON endpoints, Jest.

---

## Files

Modify:

- `libs/shared/api-contracts/src/lib/schemas.ts`
- `apps/story-companion/src/app/core/story-types.ts`
- `apps/story-companion/src/app/core/story-factories.ts`
- `apps/story-companion/src/app/core/story-session.service.ts`
- `apps/story-companion/src/app/core/local-story.provider.ts`
- `apps/story-companion/src/app/core/puter-story.provider.ts`
- `apps/story-companion/src/app/features/workspace/story-workspace.component.ts`
- `apps/story-companion/src/app/features/workspace/story-workspace.component.html`
- `apps/story-companion/src/app/features/workspace/story-workspace.component.scss`
- `apps/llama-proxy-ts/src/app/app.ts`

Possibly create:

- `apps/story-companion/src/app/core/world-delta.ts`
- `apps/story-companion/src/app/features/world-panel/world-panel.component.ts`
- `apps/story-companion/src/app/features/world-panel/world-panel.component.html`
- `apps/story-companion/src/app/features/world-panel/world-panel.component.scss`

Reference only:

- `libs/shared/world-state/src/lib/world-state.service.ts`
- `libs/shared/world-state/src/lib/world-panel/world-panel.component.ts`
- `apps/llama-proxy/routes/world_state.py`

## Constraints

- World-state updates must be non-blocking for chat.
- Delta application must be deterministic and unit tested.
- Existing sessions with minimal world state must hydrate with defaults.
- Adventure only; no bond state.
- UI should present world state as compact operational panels, not decorative cards inside cards.

## Do Not

- Do not add `bond_update` behavior.
- Do not make failed world extraction fail the user's chat turn.
- Do not invent schemas the UI does not consume.
- Do not store world state globally across all sessions.
- Do not require Python proxy endpoints.

## Task 1: Define Adventure World State Types

- [ ] Write failing tests for schema defaults.

Target:

- `libs/shared/api-contracts/src/lib/schemas.spec.ts`

Test intent:

```typescript
it('accepts adventure world-state deltas with events scene clock and factions', () => {
  const delta = worldStateDeltaSchema.parse({
    faction_changes: [{ faction_id: 'guild', standing_delta: 5, notes_append: 'helped' }],
    scene_update: { location_id: 'gate', new_tension: 'tense', scene_note: 'At the gate.' },
    clock_advance: { turns: 1 },
    key_facts_append: ['The gate is barred.'],
  });

  expect(delta.faction_changes).toHaveLength(1);
});
```

- [ ] Ensure shared schema covers consumed fields:

  - factions
  - npc changes
  - new events
  - scene update
  - clock advance
  - key facts
  - quest updates
  - player update
  - story beat update
  - ambient inject
  - npc rumors
  - faction drift

- [ ] Keep `bond_update` tolerated but unused.

## Task 2: Add Pure Delta Application

- [ ] Create `apps/story-companion/src/app/core/world-delta.ts`.

Exports:

```typescript
export function applyWorldDelta(world: StoryWorldState, delta: WorldStateDeltaDto): StoryWorldState
export function makeWorldStateForScenario(id: string, scenario: ScenarioDto): StoryWorldState
```

- [ ] Unit tests must cover:

  - appending key facts without duplicates
  - updating scene
  - changing NPC disposition/status
  - changing faction standing
  - adding events
  - advancing clock
  - adding ambient inject without losing existing state

- [ ] Move world update logic out of `StorySessionService` into this helper.

## Task 3: Expand Initial World State

- [ ] Update `story-factories.ts` so adventure sessions initialize:

  - current scene
  - world clock
  - NPC states from scenario NPCs
  - empty factions
  - empty quest log
  - empty event log
  - empty session summaries
  - player character from scenario

- [ ] Preserve existing minimal sessions by defaulting missing arrays in accessors/helpers.

## Task 4: TS Proxy World Prompts

- [ ] Expand `/world-state/update` prompt in `llama-proxy-ts` to match adventure behavior from Python proxy.

Requirements:

  - only mark death when explicit
  - use known NPC/faction IDs only
  - cap disposition changes
  - events only for distinct actions/discoveries/confrontations
  - update scene and tension conservatively
  - return empty delta when nothing changed

- [ ] Expand `/world-state/tick` so it can emit:

  - ambient inject
  - npc rumors
  - faction drift

- [ ] Proxy tests must verify prompts include known IDs and parse empty fallback correctly.

## Task 5: Workspace World Panel

- [ ] Create or update world panel with tabs:

  - Scene
  - Factions
  - NPCs
  - Events
  - Quests

- [ ] Add toggle button in workspace header.

- [ ] Show ambient injects as transient text after successful turns.

- [ ] Add contradiction detection if enough known facts exist:

  - simple string similarity or exact contradiction heuristics are acceptable for v1
  - never block chat
  - present dismissible warning

## Task 6: Session Summaries

- [ ] Add summary generation trigger every 20 user turns.

- [ ] Add `/world-state/summary` usage for local provider.

- [ ] For Puter provider, implement provider-side summary extraction with same result shape.

- [ ] Store summaries in session world state.

- [ ] Do not summarize on every turn.

## Task 7: Final Verification

- [ ] Run:

```bash
npx nx test shared-api-contracts --runInBand --skip-nx-cache
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

- [ ] Commit:

```bash
git add libs/shared/api-contracts apps/story-companion apps/llama-proxy-ts
git commit -m "feat(story): expand adventure world state"
```
