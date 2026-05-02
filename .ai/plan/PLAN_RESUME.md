# Resume Plan: Adventure-Only Migration (Phases 4 finish → Phase 5)

**Generated:** 2026-05-02  
**Based on:** `HANDOVER_FOR_CLAUDE_CODE.md` + audit of current code  
**Branch:** `feat/frontend-lib-architecture`

---

## Current State Summary

| Phase | Status |
|-------|--------|
| Phase 1 — Adventure-only foundation | ✅ Complete |
| Phase 2 — Core chat parity | ✅ Complete |
| Phase 3 — Scenario tooling | ✅ Complete |
| Phase 4 — Living world systems | ⚠️ ~90% done — 2 gaps remain |
| Phase 5 — DM / Journal / Combat | ❌ Not started |

**All tests green on last handover commit.**

---

## Phase 0: Baseline Verification

Before any code changes, verify nothing regressed.

```bash
npx nx test shared-api-contracts --runInBand --skip-nx-cache
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
CI=1 npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

All must pass before proceeding.

---

## Phase 4 Finish: Two Remaining Gaps

**Reference plan:** `.ai/plan/04-living-world-adventure-systems.md`

### Gap 1 — Legacy session hydration (REQUIRED)

**File:** `apps/story-companion/src/app/core/story-session.service.ts`  
**Problem:** `loadSession()` (around line 60–65) does not call `normalizeWorldState()` before returning a session. Sessions stored before Phase 4 may have `undefined` arrays where code expects `[]`.

**Fix:**
1. Import `normalizeWorldState` from `./world-delta`
2. In `loadSession()`, after fetching the session from IndexedDB, call:
   ```typescript
   session.worldState = normalizeWorldState(session.worldState, session.scenario);
   ```
   before storing/returning it.
3. Add a unit test in `story-session.service.spec.ts` that loads a session with a minimal/empty world state and asserts the returned session has all expected arrays defined.

**Verification:** `npx nx test story-companion --runInBand --skip-nx-cache`

### Gap 2 — Unit test structure (OPTIONAL quality improvement)

**File:** `apps/story-companion/src/app/core/world-delta.spec.ts`  
**Problem:** One monolithic test covers all 7 cases. Plan intended 7 separate `it()` blocks.

**Fix:** Split into separate `it()` blocks:
1. `it('appends key facts without duplicates', ...)`
2. `it('updates scene', ...)`
3. `it('changes NPC disposition and status', ...)`
4. `it('changes faction standing', ...)`
5. `it('adds events', ...)`
6. `it('advances clock', ...)`
7. `it('adds ambient inject without losing existing state', ...)`

**Note:** Functionally already complete. Do this after Gap 1 is done and tested.

### Phase 4 Checklist Sign-Off

After both gaps are addressed, mark all checkboxes in `.ai/plan/04-living-world-adventure-systems.md` as `[x]`.

### Commit

```bash
git add apps/story-companion
git commit -m "fix(story): hydrate legacy sessions via normalizeWorldState on load"
```

---

## Phase 5: DM / Journal / Combat

**Reference plan:** `.ai/plan/05-dm-journal-combat.md`  
Execute tasks in order. Each task must leave tests passing.

### Task 1 — Routes and navigation

**Files to modify:**
- `apps/story-companion/src/app/app.routes.ts`
- `apps/story-companion/src/app/features/workspace/story-workspace.component.html`

**What to do:**
1. Add three lazy-loaded routes inside the workspace section:
   ```typescript
   { path: 'workspace/:id/dm', loadComponent: () => import('./features/dm/dm.component').then(m => m.DmComponent) },
   { path: 'workspace/:id/journal', loadComponent: () => import('./features/journal/journal.component').then(m => m.JournalComponent) },
   { path: 'workspace/:id/combat', loadComponent: () => import('./features/combat/combat.component').then(m => m.CombatComponent) },
   ```
2. Add header nav links in workspace component pointing to these routes.
3. Add a test in `app.routes.spec.ts` (or equivalent) verifying all three routes exist in the config.

**Reference (read these for existing patterns):**
- Current route structure: `apps/story-companion/src/app/app.routes.ts`
- Existing workspace header: `apps/story-companion/src/app/features/workspace/story-workspace.component.html`

**Verification:** `npx nx test story-companion --runInBand --skip-nx-cache`

---

### Task 2 — TS proxy endpoints

**File to modify:** `apps/llama-proxy-ts/src/app/app.ts`  
**File to modify:** `libs/shared/api-contracts/src/lib/schemas.ts`  
**Reference (read only):** `apps/llama-proxy/routes/generate.py`, `apps/llama-proxy/routes/combat.py`

**What to add:**

1. Schemas in `schemas.ts`:
   - `generateFactionSetResponseSchema` — array of 3 factions with `id`, `name`, `description`, `standing` (default 50)
   - `generateOpeningSceneResponseSchema` — `{ title, description, opening_line, tension }`
   - `combatResolveTurnResponseSchema` — `{ narrative, hp_changes: Record<string, number>, status_changes: Record<string, string>, round_end: boolean }`
   - Note: `generateOracleResponseSchema` may already exist (Phase 2 added `/generate-oracle` — check before adding)

2. Endpoints in `app.ts`:
   ```
   POST /generate-faction-set
   POST /generate-opening-scene
   POST /combat/resolve-turn
   ```
   (Check if `POST /generate-oracle` already exists before adding)

3. Prompt behavior per plan:
   - faction set: exactly 3 factions with IDs, name, description
   - opening scene: title, description, opening line, tension level
   - oracle: result and detail (if not already done)
   - combat resolve: narrative, hp changes, status changes, round end flag

4. Tests using mocked `llmClient.complete` — no live LLM calls.

**Verification:**
```bash
npx nx test shared-api-contracts --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
```

---

### Task 3 — DM component (Quests + NPCs)

**Files to create:**
- `apps/story-companion/src/app/features/dm/dm.component.ts`
- `apps/story-companion/src/app/features/dm/dm.component.html`
- `apps/story-companion/src/app/features/dm/dm.component.scss`

**Possibly create:** `apps/story-companion/src/app/core/dm-tools.service.ts`

**Reference (read only):**
- `libs/feature-dm/src/lib/dm.component.ts`
- `libs/feature-dm/src/lib/session-zero/session-zero.component.ts`

**What to implement:**
- Two-tab component: **Quests** | **NPCs**
- Quest tool: prompt + party level + optional setting/tone → generate quest → editable result → save to collection → promote to quest log (session world state)
- NPC tool: name + description + optional setting/tone → generate NPC → editable fields → save to collection → promote to world NPC list
- Store collections inside active session metadata (IndexedDB, not global localStorage)
- Generated items must NOT auto-promote; explicit user action required

**Do not:** port partner/interpersonal session-zero steps.

---

### Task 4 — Journal component

**Files to create:**
- `apps/story-companion/src/app/features/journal/journal.component.ts`
- `apps/story-companion/src/app/features/journal/journal.component.html`
- `apps/story-companion/src/app/features/journal/journal.component.scss`

**Reference (read only):** `libs/feature-journal/src/lib/journal.component.ts`

**What to implement:**
Four tabs reading from active `StorySession.worldState`:

| Tab | Content source |
|-----|----------------|
| **Quests** | `worldState.questLog` — active + completed, with objective checkboxes |
| **Events** | `worldState.events` — certainty labels, NPC/faction labels |
| **Sessions** | `worldState.sessionSummaries` + `keyFacts` |
| **Character** | `worldState.playerCharacter` — name, description, HP, aptitudes |

**Do not:** show bond data, partner data, or interpersonal fields.

---

### Task 5 — Combat service and component

**Files to create:**
- `apps/story-companion/src/app/core/combat.service.ts`
- `apps/story-companion/src/app/features/combat/combat.component.ts`
- `apps/story-companion/src/app/features/combat/combat.component.html`
- `apps/story-companion/src/app/features/combat/combat.component.scss`

**Reference (read only):** `libs/feature-combat/src/lib/combat.component.ts`

**`CombatService` responsibilities:**
```typescript
startCombat(npcIds: string[]): Promise<void>
resolveTurn(actionText: string): Promise<void>
endCombat(outcome: 'victory' | 'flee' | 'tpk'): Promise<void>
```

**Combat state shape (stored in `worldState.combat`):**
```typescript
{
  active: boolean;
  round: number;
  initiativeOrder: string[];  // entity IDs
  activeEntityIndex: number;
  log: Array<{ round: number; actor: string; narrative: string }>;
}
```

**`CombatComponent` UI:**
- Initiative tracker
- Combat log
- Action input (calls `resolveTurn`)
- Flee button
- End combat button
- Outcome overlay on `endCombat`

**On `endCombat`:** navigate back to workspace + append world event via `StorySessionService`.

**Do not:** mutate chat messages from combat actions.

---

### Task 6 — Session Zero Wizard (OPTIONAL)

Only implement if Tasks 1–5 are complete and tests pass.

Adventure-only steps: premise → factions → key NPCs → opening scene → create session.  
Do not include partner or relationship steps.

---

### Task 7 — Phase 5 Final Verification

```bash
npx nx test shared-api-contracts --runInBand --skip-nx-cache
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
CI=1 npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

Manual smoke test (with servers running via `npm run serve:proxy` + `npm run serve:story`):
1. Create adventure scenario.
2. Open workspace.
3. Open DM → generate quest → promote to journal.
4. Start combat from workspace.
5. Resolve one combat turn.
6. End combat → verify return to workspace + world event appended.

**Commit:**
```bash
git add apps/story-companion apps/llama-proxy-ts libs/shared/api-contracts
git commit -m "feat(story): add dm journal combat"
```

---

## Key Constraints (carry into each session)

- All standalone Angular components (no NgModules).
- State via signals (`signal()`, `.set()`, `.update()`).
- No Python proxy dependency for new app.
- No bond/partner/interpersonal features.
- No global localStorage for session data (IndexedDB only).
- Combat state lives in `worldState.combat`, not separate store.
- Add failing tests before behavior changes.
- `CI=1` prefix for story-companion builds.

## Anti-Patterns to Avoid

- Do not invent proxy endpoints not listed above.
- Do not call live LLM in tests — mock `llmClient.complete`.
- Do not auto-promote DM-generated content to world state.
- Do not couple combat UI to ChatComponent internals.
- Do not add broad refactors outside active task.