# DM Journal Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adventure-only DM tools, journal, and combat systems to `story-companion`.

**Architecture:** Implement these as new `story-companion` feature areas that read and write `StorySession` world state through `StorySessionService`. Add missing `llama-proxy-ts` endpoints so the new app does not depend on the Python proxy.

**Tech Stack:** Angular 21 standalone routes/components, signals, IndexedDB, Fastify, Zod, Jest.

---

## Files

Modify:

- `apps/story-companion/src/app/app.routes.ts`
- `apps/story-companion/src/app/core/story-session.service.ts`
- `apps/story-companion/src/app/core/story-types.ts`
- `apps/llama-proxy-ts/src/app/app.ts`
- `libs/shared/api-contracts/src/lib/schemas.ts`

Create feature areas:

- `apps/story-companion/src/app/features/dm/dm.component.ts`
- `apps/story-companion/src/app/features/dm/dm.component.html`
- `apps/story-companion/src/app/features/dm/dm.component.scss`
- `apps/story-companion/src/app/features/journal/journal.component.ts`
- `apps/story-companion/src/app/features/journal/journal.component.html`
- `apps/story-companion/src/app/features/journal/journal.component.scss`
- `apps/story-companion/src/app/features/combat/combat.component.ts`
- `apps/story-companion/src/app/features/combat/combat.component.html`
- `apps/story-companion/src/app/features/combat/combat.component.scss`

Possibly create:

- `apps/story-companion/src/app/core/dm-tools.service.ts`
- `apps/story-companion/src/app/core/combat.service.ts`

Reference only:

- `libs/feature-dm/src/lib/dm.component.ts`
- `libs/feature-dm/src/lib/session-zero/session-zero.component.ts`
- `libs/feature-journal/src/lib/journal.component.ts`
- `libs/feature-combat/src/lib/combat.component.ts`
- `apps/llama-proxy/routes/generate.py`
- `apps/llama-proxy/routes/combat.py`

## Constraints

- Adventure only.
- DM, journal, and combat must operate on the active `StorySession`.
- The new app must remain usable without opening DM tools.
- DM generated quests/NPCs can be saved locally and optionally promoted into world state.
- Combat state must be part of world state, not separate global browser storage.

## Do Not

- Do not port partner/interpersonal session-zero behavior.
- Do not require the legacy Python proxy.
- Do not couple combat UI to chat component internals.
- Do not make DM tools a blocking step before starting an adventure.
- Do not silently add generated quests/NPCs to world state without user action.

## Task 1: Add Routes And Navigation

- [ ] Add routes:

```typescript
{
  path: 'workspace/:id/dm',
  loadComponent: () => import('./features/dm/dm.component').then((m) => m.DmComponent),
},
{
  path: 'workspace/:id/journal',
  loadComponent: () => import('./features/journal/journal.component').then((m) => m.JournalComponent),
},
{
  path: 'workspace/:id/combat',
  loadComponent: () => import('./features/combat/combat.component').then((m) => m.CombatComponent),
}
```

- [ ] Add workspace header links/buttons to DM, Journal, Combat.

- [ ] Tests must verify route config includes all three feature routes.

## Task 2: TS Proxy Endpoints

- [ ] Add schemas for:

  - generate faction set
  - generate opening scene
  - generate oracle
  - combat resolve turn

- [ ] Add endpoints:

```text
POST /generate-faction-set
POST /generate-opening-scene
POST /generate-oracle
POST /combat/resolve-turn
```

- [ ] Prompt behavior:

  - faction set returns exactly 3 factions with IDs
  - opening scene returns title, description, opening line, tension
  - oracle returns result and detail
  - combat resolution returns narrative, hp changes, status changes, round end

- [ ] Tests must use mocked `llmClient.complete` and assert parsed responses.

- [ ] Do not call the live LLM in tests.

## Task 3: DM Quest And NPC Tools

- [ ] Create `DmComponent` with two tabs:

  - Quests
  - NPCs

- [ ] Quest tool:

  - prompt
  - party level
  - optional setting/tone
  - generate quest
  - editable result fields
  - save to local collection
  - promote to quest log

- [ ] NPC tool:

  - name
  - description
  - optional setting/tone
  - generate NPC
  - editable detailed NPC fields
  - save to local collection
  - promote to world NPC list

- [ ] Store saved DM collections either inside active session metadata or under an IndexedDB store keyed by session id.

- [ ] Do not use global localStorage collections for new app unless there is no IndexedDB-compatible path.

## Task 4: Journal

- [ ] Create `JournalComponent` with tabs:

  - Quests
  - Events
  - Sessions
  - Character

- [ ] Quest tab:

  - active quests
  - completed quests
  - objective checkboxes

- [ ] Events tab:

  - recent events
  - event certainty labels
  - involved NPC/faction labels where available

- [ ] Sessions tab:

  - session summaries
  - key facts

- [ ] Character tab:

  - player character name/description
  - HP if present
  - aptitudes if present

- [ ] Do not show interpersonal bond data.

## Task 5: Combat

- [ ] Create `CombatService`.

Responsibilities:

```typescript
startCombat(npcIds: string[]): Promise<void>
resolveTurn(actionText: string): Promise<void>
endCombat(outcome: 'victory' | 'flee' | 'tpk'): Promise<void>
```

- [ ] Combat state shape:

  - active
  - round
  - initiative order
  - active entity index
  - log

- [ ] Create `CombatComponent` UI:

  - initiative tracker
  - combat log
  - action input
  - flee
  - end combat
  - outcome overlay

- [ ] When combat ends, return to workspace and append a world event.

- [ ] Do not let combat actions mutate chat messages directly.

## Task 6: Optional Session Zero Adventure Wizard

- [ ] Only implement if Phases 1-5 are complete.

- [ ] Adventure-only steps:

  - premise
  - factions
  - key NPCs
  - opening scene
  - create session

- [ ] Do not include partner or relationship steps.

## Task 7: Final Verification

- [ ] Run:

```bash
npx nx test shared-api-contracts --runInBand --skip-nx-cache
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

- [ ] Manual smoke test:

```bash
npm run serve:proxy
npm run serve:story
```

Then in the browser:

1. Create adventure scenario.
2. Open workspace.
3. Open DM.
4. Generate quest.
5. Promote quest to journal.
6. Start combat from workspace.
7. Resolve one combat turn.
8. End combat and return to workspace.

- [ ] Commit:

```bash
git add apps/story-companion apps/llama-proxy-ts libs/shared/api-contracts
git commit -m "feat(story): add adventure dm journal combat"
```
