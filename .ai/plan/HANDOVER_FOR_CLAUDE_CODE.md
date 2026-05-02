# Handover: Adventure-Only Migration (Phases 1-5)

## Context
- Workspace: `/Users/dominique/IdeaProjects/nx-monorepo-experiment`
- Master plan: `.ai/plan/00-adventure-only-index.md`
- Requested execution mode: phase-by-phase, with code-review checkpoint after each phase.

## What Is Done

### Phase 1 completed
- Wizard locked to adventure-only (no interpersonal selector).
- `StorySessionService` scenario generation narrowed to `'adventure'`.
- Providers updated for adventure-only scenario generation.
- `llama-proxy-ts` `/generate-scenario` now accepts only `scenario_type: 'adventure'` (rejects interpersonal).
- Removed interpersonal partner chat branch from new proxy prompt builder.
- Added/updated tests for all above.
- Phase 1 checklist marked complete in: `.ai/plan/01-adventure-only-foundation.md`

### Phase 2 completed
- Added `ChatRenderingService` (markdown + `<think>` handling + sanitization).
- Workspace supports: Enter-to-send / Shift+Enter newline, send guard for empty draft, Stop / Regenerate / Retry / Reset / New / Edit / Delete controls + confirmations, context usage warning + trim/export/export+reset actions, AI assist (`AdventureAssistService`) suggest/rewrite flow, Oracle panel + recent oracle results.
- Added `/generate-oracle` endpoint in TS proxy + tests.
- Cancellation behavior hardened (cooperative cancel, avoids premature loading state drop).
- Phase 2 checklist marked complete in: `.ai/plan/02-core-adventure-chat-parity.md`

### Phase 3 completed
- Added structured scenario editor (title/setting/tone/character/npcs/rules, NPC stats, NPC detail generation button).
- Wizard uses structured editor as primary flow, with collapsed advanced JSON panel.
- Added preset loading service + assets (`grim-frontier.json`).
- Added edit-scenario flow from workspace to wizard (`?edit=:id`) with explicit choices.
- `/generate-npc` response now schema-validated in proxy.
- Phase 3 checklist marked complete in: `.ai/plan/03-adventure-scenario-tooling.md`

### Phase 4 completed
- Added world delta helper module (`world-delta.ts` with `applyWorldDelta`, `makeWorldStateForScenario`, `normalizeWorldState`).
- Expanded world-state shape in `story-types.ts` (factions/events/summaries/ambient/rumors/playerCharacter/combat).
- `StorySessionService.loadSession()` now calls `normalizeWorldState()` to hydrate legacy sessions (with null-scenario guard).
- Added session summary trigger every 20 user turns.
- Expanded `/world-state/update` and `/world-state/tick` proxy routes with adventure-specific prompts.
- Added `WorldPanelComponent` with Scene/Factions/NPCs/Events/Quests tabs + workspace toggle.
- Contradiction detection in workspace (dismissible, non-blocking).
- Both local and Puter providers implement `summarizeSession()`.
- Phase 4 checklist complete in: `.ai/plan/04-living-world-adventure-systems.md`

### Phase 5 completed
- **Task 1:** Added routes `workspace/:id/dm`, `workspace/:id/journal`, `workspace/:id/combat` (lazy-loaded). Nav links added to workspace header.
- **Task 2:** Added to `llama-proxy-ts`: `POST /generate-faction-set`, `POST /generate-opening-scene`, `POST /combat/resolve-turn`. All with Zod schemas in `shared-api-contracts` and mocked tests. Added graceful fallbacks to pre-existing `/generate-npc` and `/generate-oracle`. Fixed `/generate-faction-set` response schema from `.length(3)` to `.min(1)`. Fixed `proxy.conf.json` to include `/generate`, `/assist`, `/combat` prefixes (were previously missing — calls would 404 in dev).
- **Task 3:** `DmComponent` (Quests + NPCs tabs) with `DmToolsService`. Generate/edit/save/promote flow. Session guard on promote. NPC collection uses stable `_id` for deduplication. `StorySessionService` extended with `addQuestToSession()` and `addNpcToSession()`.
- **Task 4:** `JournalComponent` (Quests / Events / Sessions / Character tabs) reading from `worldState`.
- **Task 5:** `CombatService` (`startCombat`, `resolveTurn`, `endCombat`). `CombatComponent` with initiative tracker, combat log, action input, flee/end buttons. Combat state stored in `worldState.combat`. `endCombat` appends world event and navigates back to workspace. `StorySessionService` extended with `setCombatState()` and `appendWorldEvent()`.
- Phase 5 checklist complete in: `.ai/plan/05-dm-journal-combat.md`

## Verification Status (latest)
All currently green:
- `npx nx test shared-api-contracts --runInBand --skip-nx-cache` ✅ (12 tests)
- `npx nx test story-companion --runInBand --skip-nx-cache` ✅ (50 tests, 16 suites)
- `npx nx test llama-proxy-ts --runInBand --skip-nx-cache` ✅ (19 tests)
- `CI=1 npx nx build story-companion --skip-nx-cache` ✅
- `npx nx build llama-proxy-ts --skip-nx-cache` ✅

## Code-Review Checkpoints
- Phase 1: reviewed, issues resolved.
- Phase 2: reviewed, issues resolved.
- Phase 3: reviewed, issues resolved.
- Phase 4: reviewed, issues resolved (loadSession null-scenario crash + test coverage).
- Phase 5: reviewed per task, issues resolved:
  - Task 1: route test coverage strengthened (added `loadComponent` assertion)
  - Task 2: `.length(3)` → `.min(1)` on faction schema; fallbacks added to `/generate-npc` and `/generate-oracle`; proxy.conf.json fixed
  - Task 3: NPC dedup fixed (stable `_id`); session guard added to promote methods
  - Task 4: no issues found
  - Task 5: awaiting final review result

## What Still Needs To Be Done

### Task 5 review (in flight)
Review agent checking for race conditions, double-call safety, error handling in CombatService.

### Phase 5 Task 6 — Session Zero Wizard (OPTIONAL)
Adventure-only steps: premise → factions → key NPCs → opening scene → create session.
Only implement if time/priority warrants. Do not include partner or relationship steps.

### Manual smoke test (not yet run)
```bash
npm run serve:proxy
npm run serve:story
```
Browser flow:
1. Create adventure scenario.
2. Open workspace → verify DM/Journal/Combat nav links.
3. Open DM → generate quest → promote to journal.
4. Open Journal → verify quest appears in Quests tab.
5. Start combat from workspace combat route.
6. Resolve one combat turn.
7. End combat → verify return to workspace + event appears in Journal Events tab.

## Notes
- `story-companion` build can appear flaky if run without `CI=1` in this environment; with `CI=1` it has been stable.
- There are many pre-existing unrelated workspace changes and untracked directories; do not reset them.
- `proxy.conf.json` updated to use `/generate` and `/combat` prefix entries (covers all current + future generate-* and combat routes).
