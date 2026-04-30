# Plan: Frontend Nx Library Architecture (v2)

> Revised after critical architectural review. Addresses root causes (service coupling, false sharing, boundary violations) before structural file moves.

---

## Problem

`apps/llama-chat` monolith has three root causes that make AI-assisted planning expensive:

1. **WorldStateService is a 713-line god service** — 17 methods across 7 domains in one class. AI working on combat must read the full file. Model types (258 lines) are equally mixed: combat, NPC, quest, bond, player, faction all in one file.
2. **AiAssistService is falsely shared** — `generateNpc()`, `generateQuest()` belong to DM; `generateScenario()` belongs to scenario setup; `suggestInput()`, `rewriteInput()` belong to chat. No method is genuinely cross-feature.
3. **No import boundary enforcement** — any component can import any service. Nx module boundary rules can fix this, but only if the library structure is clean first.

**Wrong fix:** moving files into Nx libs without changing coupling. Result: same 713-line god service, just at a new path. Nx boundary violations on day 1 (SettingsService in feature-settings while ChatService needs it).

**Right fix order:** decompose services → dissolve false sharing → then extract libs.

---

## Architecture Decision: Nx Libraries (NOT separate Angular apps)

Unchanged from v1. `WorldStateService` is consumed by 6 of 8 routes. Separate apps require cross-app state sync (SharedWorker / backend state). Worse than the problem.

**Strongest actual benefit (undersold in v1):** `nx affected`. Touching `shared-world-state` today would re-test the entire monolith. With libs, Nx correctly re-tests only `feature-chat`, `feature-dm`, `feature-combat`, `feature-journal` — skips `feature-settings`, `feature-scenario`. This compounds as the test suite grows.

---

## What Changed from v1

| Issue | v1 Plan | v2 Fix |
|-------|---------|--------|
| WorldStateService still 713 lines after lib move | Ignored | Phase 1-2: decompose model + extract domain services |
| AiAssistService in shared-ai (false sharing) | Put in shared | Phase 3: dissolve — move each method to its feature |
| SettingsService in feature-settings | Wrong placement → boundary violation | Stays in `shared-settings` lib; only SettingsComponent in `feature-settings` |
| Phases 3 "features any order" claim | Incorrect | Only true after ALL Phase 5 (shared) complete |
| Lazy-load framing as new benefit | Already existed | Removed; replaced with `nx affected` as main CI/CD benefit |
| Journal/Settings lib overhead | Treated same as feature-chat | Noted as thin; kept for consistency |
| `--buildable` flag not specified | Missing | Added to all generator commands |

---

## Updated Library Structure

```
libs/
├── shared/
│   ├── world-state/        # WorldStateStore (signal+IDB), WorldStateService (applyDelta facade)
│   │                       # Domain services: NpcStateService, QuestStateService,
│   │                       #   PlayerStateService, FactionStateService
│   │                       # Models: world-state.model, combat.model, npc.model,
│   │                       #   quest.model, bond.model, player.model, faction.model, story.model
│   ├── scenario/           # ScenarioService, ScenarioModel (Scenario, ScenarioType, Npc, InputType)
│   ├── settings/           # SettingsService (consumed by ChatService + SettingsComponent)
│   └── ui/                 # ErrorBoundaryComponent, AppErrorService, LoadingBusService
├── feature-chat/           # ChatComponent, ChatService, SessionService, WorldSyncService
│                           # BondStateService (bond mutations — chat-only)
│                           # WorldPanelComponent
│                           # Chat AI: suggestInput(), rewriteInput() HTTP calls (was in AiAssistService)
├── feature-dm/             # DmComponent, SessionZeroComponent, DmModel, DmNpcAdapter
│                           # DM AI: generateNpc(), generateQuest() HTTP calls (was in AiAssistService)
├── feature-combat/         # CombatComponent, CombatService, sub-components
│                           # CombatStateService (combat mutations — combat-only)
├── feature-journal/        # JournalComponent (thin display; kept for lib consistency)
├── feature-settings/       # SettingsComponent ONLY (imports shared-settings for SettingsService)
└── feature-scenario/       # ScenarioFormComponent, PresetScenarioService
                            # Scenario AI: generateScenario() HTTP call (was in AiAssistService)
```

Shell app (`apps/llama-chat`) retains ONLY:
- `app.routes.ts`, `app.config.ts`, `app.ts`, `app.html`, `app.scss`

---

## Domain Service Pattern (WorldStateService decomposition)

Single `state` signal stays centralized — there is ONE source of truth for WorldState. Domain services all inject `WorldStateStore` and mutate via its `update()` method.

```
WorldStateStore                    — signal<WorldState> + IDB persistence + migrate()
├── NpcStateService                — addNpcState(), updateNpcState(), applyNpcChanges()
├── QuestStateService              — addQuest(), updateQuestObjective(), applyQuestUpdates()
├── PlayerStateService             — applyPlayerUpdate()
├── FactionStateService            — addFaction(), updateFaction(), applyFactionChanges()
├── BondStateService  (feature-chat) — applyBondUpdate() — interpersonal mode only
├── CombatStateService (feature-combat) — setCombatState(), applyCombatDelta()
└── WorldStateService              — facade: applyDelta() orchestrates all domain services
                                   — toCompactPrompt(), detectContradictions(), addEvent()
                                   — addSessionSummary(), consumeAmbient(), updateScene()
                                   — initForScenario(), loadForScenario(), clearState()
```

`applyDelta(delta: WorldStateDelta)` becomes an orchestrator:
```typescript
applyDelta(delta: WorldStateDelta) {
  if (delta.npcChanges?.length)   this.npcService.applyNpcChanges(delta.npcChanges);
  if (delta.questUpdates?.length) this.questService.applyQuestUpdates(delta.questUpdates);
  if (delta.playerUpdate)         this.playerService.applyPlayerUpdate(delta.playerUpdate);
  if (delta.factionChanges?.length) this.factionService.applyFactionChanges(delta.factionChanges);
  if (delta.bondUpdate)           this.bondService.applyBondUpdate(delta.bondUpdate);
  if (delta.combatDelta)          this.combatService.applyCombatDelta(delta.combatDelta);
  // scene, clock, keyFacts, events, storyBeat, ambient handled directly (no separate service)
}
```

**AI scoping result:** AI working on combat reads `CombatStateService` (~80 lines) + `combat.model.ts` (~30 lines) = ~110 lines. Not 713.

---

## AiAssistService Dissolution

Current `AiAssistService` methods → new owners:

| Method | Endpoint | New owner | New location |
|--------|----------|-----------|--------------|
| `suggestInput()` | `/assist` | `ChatAssistService` | `feature-chat` |
| `rewriteInput()` | `/assist` | `ChatAssistService` | `feature-chat` |
| `generateScenario()` | `/generate-scenario` | `ScenarioApiService` | `feature-scenario` |
| `generateNpc()` | `/generate-npc` | `DmApiService` | `feature-dm` |
| `generateQuest()` | `/generate-quest` | `DmApiService` | `feature-dm` |

Each new service injects `HttpClient` directly. No shared HTTP wrapper needed — all endpoints are behind the same proxy, all use `AbortSignal.timeout(environment.timeoutMs)`.

`WorldSyncService` (calls `/world-sync`) → moves to `feature-chat` (only `SessionService` calls it).

---

## SettingsService Placement

`SettingsService` (139 lines) exposes: `contextWindow`, `enableThinking`, `toneSettings`, `backends`, `activeId` — all consumed by `ChatService`. If placed in `feature-settings`, `feature-chat → feature-settings` = boundary violation.

**Placement:** `shared-settings` lib. `SettingsComponent` alone goes to `feature-settings`.

---

## Dependency Graph (enforced via Nx tags)

```
scope:app      → scope:feature + scope:shared
scope:feature  → scope:shared only (NEVER feature → feature)
scope:shared   → scope:shared only (NEVER shared → feature)
```

Concrete:
```
feature-chat     → shared-world-state, shared-scenario, shared-settings, shared-ui
feature-dm       → shared-world-state, shared-scenario, shared-ui
feature-combat   → shared-world-state, shared-scenario, shared-ui
feature-journal  → shared-world-state, shared-ui
feature-settings → shared-settings, shared-ui
feature-scenario → shared-scenario, shared-ui
```

---

## Phase 0: Documentation Discovery (COMPLETE)

Sources: `world-state.service.ts` (713 lines), `world-state.model.ts` (258 lines), `ai-assist.service.ts` (219 lines), `settings.service.ts` (139 lines), `app.routes.ts`, `project.json`, `package.json`.

**Allowed APIs (Nx 22.5.2, Angular 21):**
- Generator: `npx nx g @nx/angular:library <name> --directory=libs/<name> --tags='...' --standalone --no-routing --buildable`
- Boundary enforcement: `@nx/enforce-module-boundaries` in `eslint.config.js`
- Affected: `npx nx affected -t test`

---

## Phase 1: Decompose world-state.model.ts into Domain Model Files

**Context for executor:** `apps/llama-chat/src/app/world-state/world-state.model.ts` is 258 lines mixing 7 domains. Split into focused model files IN-PLACE (still inside the app — no Nx libs yet). This is a safe file split with no logic changes.

**New files to create** (all in `apps/llama-chat/src/app/world-state/`):

### `combat.model.ts`
Move from `world-state.model.ts`:
- `CombatParticipant` (L165–171)
- `CombatState` (L173–179)
- `CombatDelta` (L181–186)

### `npc.model.ts`
Move from `world-state.model.ts`:
- `NpcStatus` type alias (L1)
- `NpcRelationship` (L113–117)
- `NpcState` (L119–128)
- `NpcChange` (L243–249)

### `quest.model.ts`
Move from `world-state.model.ts`:
- `QuestEntry` (L36–46)
- `QuestUpdate` (L73–78)

### `bond.model.ts`
Move from `world-state.model.ts`:
- `RelationshipTier` (L10)
- `EmotionalTemperature` (L11)
- `MemoryAnchor` (L13–18)
- `BondState` (L20–26)
- `BondUpdate` (L28–34)

### `player.model.ts`
Move from `world-state.model.ts`:
- `PlayerCharacter` (L48–63)
- `PlayerUpdate` (L80–86)

### `faction.model.ts`
Move from `world-state.model.ts`:
- `Faction` (L92–102)
- `FactionChange` (L237–241)

### `story.model.ts`
Move from `world-state.model.ts`:
- `AmbientEvent` (L4–7)
- `StoryBeat` type alias (L65–71)
- `EventType` type alias (L87)
- `EventCertainty` type alias (L88)
- `TimeOfDay` type alias (L90)
- `SceneTension` type alias (L89)
- `StoryEvent` (L130–141)

### `world-state.model.ts` retains (root aggregate + shared types):
- `WorldLocation` (L104–111)
- `WorldClock` (L150–155)
- `CurrentScene` (L143–148)
- `SessionSummary` (L157–163)
- `ClockAdvance` (L214–216)
- `WorldState` (L188–211) — now imports from all domain model files
- `WorldStateDelta` (L218–235) — now imports from all domain model files

**Tasks:**
1. Read `apps/llama-chat/src/app/world-state/world-state.model.ts` in full (do this first — it's 258 lines).
2. Create each domain model file with the correct types moved out.
3. Update `world-state.model.ts` to import from the new files (for `WorldState` and `WorldStateDelta`).
4. Update `world-state.service.ts` imports — it currently imports everything from `./world-state.model`. Update to import domain types from their new files.
5. Grep for other callers that import from world-state.model: `grep -r "from '.*world-state.model'" apps/llama-chat/src/`. Update those imports to point to the correct domain file.
6. Grep for callers of dm.model types to ensure no duplicate definitions: `grep -r "CombatState\|NpcState\|QuestEntry\|BondState" apps/llama-chat/src/ --include="*.ts" -l`

**Anti-pattern guards:**
- Do NOT change any method signatures in world-state.service.ts — this is a type-only split
- Do NOT create new interfaces — only move existing ones
- Export everything from the new domain files; do NOT make types private

**Verification checklist:**
- [ ] `npx nx build llama-chat` passes (no missing exports, no broken imports)
- [ ] `npx nx test llama-chat` passes
- [ ] `grep -r "from '.*world-state.model'" apps/llama-chat/src/` — all imports point to the right file
- [ ] `world-state.model.ts` is under 100 lines (was 258)

---

## Phase 2: Extract Domain State Services from WorldStateService

**Context for executor:** `world-state.model.ts` is now split into domain files (Phase 1 done). Now decompose `world-state.service.ts` (713 lines) into focused domain services. All domain services share ONE `WorldStateStore` signal. Logic changes only — no Nx libs yet.

**New service: `world-state.store.ts`** (in `apps/llama-chat/src/app/world-state/`)

Extract from `world-state.service.ts`:
- `readonly state = signal<WorldState | null>(null)` (L45)
- The persistence `effect()` → StorageService → IDB (find the effect, move it)
- `migrate(raw)` method (L675–711)
- `loadForScenario(scenarioTitle)` (L116–146)
- `clearState()` (L588–595)
- `importFromFile(file)` (L450–461)
- `exportToFile()` (L438–448)

Add a public `update(fn: (s: WorldState) => WorldState): void` method that domain services use to mutate state:
```typescript
update(fn: (s: WorldState) => WorldState): void {
  this.state.update(s => s ? fn(s) : s);
}
```

**New service: `npc-state.service.ts`**

Extract from `world-state.service.ts`:
- `addNpcState(npcState: NpcState)` (L388–394)
- `updateNpcState(id, patch)` (L363–369)
- Extract the NPC mutation block from `applyDelta()` (L189–200, L196–200 NPC changes) into `applyNpcChanges(changes: NpcChange[])` private method → make public

**New service: `quest-state.service.ts`**

Extract from `world-state.service.ts`:
- `addQuest(quest: QuestEntry)` (L410–416)
- `updateQuestObjective(questId, objectiveIndex, done)` (L418–426)
- Extract quest mutation block from `applyDelta()` (L256–270) into `applyQuestUpdates(updates: QuestUpdate[])`

**New service: `player-state.service.ts`**

Extract from `world-state.service.ts`:
- Extract player mutation block from `applyDelta()` (L272–288) into `applyPlayerUpdate(update: PlayerUpdate)`

**New service: `faction-state.service.ts`**

Extract from `world-state.service.ts`:
- `addFaction(faction)` (L379–386)
- `updateFaction(id, patch)` (L355–361)
- Extract faction mutation block from `applyDelta()` into `applyFactionChanges(changes: FactionChange[])`

**New service: `bond-state.service.ts`** (will move to feature-chat in Phase 6 — create here first)

Extract from `world-state.service.ts`:
- Bond update block from `applyDelta()` (L299–320) into `applyBondUpdate(update: BondUpdate)`

**New service: `combat-state.service.ts`** (will move to feature-combat in Phase 6 — create here first)

Extract from `world-state.service.ts`:
- `setCombatState(cs)` (L584–586)
- `applyCombatDelta(delta)` (L598–659)

**Updated `world-state.service.ts`** becomes a facade:
- Injects all 6 domain services + `WorldStateStore`
- `applyDelta()` becomes orchestrator (delegates to domain services)
- Retains: `initForScenario()`, `addEvent()`, `addSessionSummary()`, `updateScene()`, `setStoryBeat()`, `consumeAmbient()`, `toCompactPrompt()`, `detectContradictions()`
- `state` signal is now on `WorldStateStore` — expose as getter: `get state() { return this.store.state; }`
- Existing callers that inject `WorldStateService` do NOT change — facade keeps all public APIs

**Tasks:**
1. Read `world-state.service.ts` in full before touching it.
2. Create `WorldStateStore` first (extract signal + persistence + migrate).
3. Create domain services one at a time. After each: `npx nx build llama-chat` must pass.
4. Update `WorldStateService` to inject domain services + delegate in `applyDelta()`.
5. Verify `WorldStateService` still has all the same public methods (callers must not change).

**Anti-pattern guards:**
- Do NOT rename any public method on `WorldStateService` — callers in existing components must not break
- Do NOT remove `state` signal from the public API — expose it as a getter delegating to `WorldStateStore.state`
- `applyDelta()` must remain on `WorldStateService` (the facade), not on individual domain services

**Verification checklist:**
- [ ] `npx nx build llama-chat` passes
- [ ] `npx nx test llama-chat` passes (all ChatService, WorldStateService specs)
- [ ] `world-state.service.ts` is under 250 lines (was 713)
- [ ] Each domain service is under 100 lines
- [ ] `grep "inject(WorldStateService)" apps/llama-chat/src/` — all callers unchanged

---

## Phase 3: Dissolve AiAssistService

**Context for executor:** WorldStateService decomposed (Phase 2 done). Now dissolve `AiAssistService` (219 lines) by moving each method to the feature that owns it. Creates `ChatAssistService`, `DmApiService`, `ScenarioApiService` inside the app. Then deletes `AiAssistService`.

**Important:** Read `apps/llama-chat/src/app/shared/ai-assist.service.ts` in full before starting. Confirm method-to-feature mapping matches findings below.

### New `apps/llama-chat/src/app/chat/chat-assist.service.ts`

Move from `AiAssistService`:
- `suggestInput(messages, inputType)` (L12–17)
- `rewriteInput(text, messages, inputType)` (L19–25)
- Private `callAssist(mode, currentText, messages, inputType)` (L155–217)

Imports needed: `InputType` from scenario.model, `ChatMessage` from chat.service, `ScenarioService`, `HttpClient`, environment.

### New `apps/llama-chat/src/app/dm/dm-api.service.ts`

Move from `AiAssistService`:
- `generateNpc(npcName, npcDescription, setting, tone, title)` (L80–105)
- `generateQuest(prompt, setting?, tone?, partyLevel?)` (L107–153)

Imports needed: `GeneratedNpcRaw, Quest, QuestEncounter, QuestMonster` from dm.model, `HttpClient`, environment.

### New `apps/llama-chat/src/app/scenario/scenario-api.service.ts`

Move from `AiAssistService`:
- `generateScenario(description, scenarioType)` (L27–78)

Imports needed: `Scenario, ScenarioType, Npc` from scenario.model, `HttpClient`, environment.

### Move `WorldSyncService` to `chat/`

`apps/llama-chat/src/app/shared/world-sync.service.ts` → `apps/llama-chat/src/app/chat/world-sync.service.ts`

Only `SessionService` calls it. Update `SessionService` import path.

### Delete `AiAssistService`

After confirming zero remaining callers:
```bash
grep -r "AiAssistService\|ai-assist.service" apps/llama-chat/src/ --include="*.ts"
```

Update all callers in components (DmComponent, ScenarioFormComponent, ChatComponent) to inject their new service.

**Tasks:**
1. Grep callers of each AiAssistService method: `grep -r "aiAssist\.\|AiAssistService" apps/llama-chat/src/ --include="*.ts" -n`
2. Create `ChatAssistService`. Update `ChatComponent` to inject it. Build.
3. Create `DmApiService`. Update `DmComponent` to inject it. Build.
4. Create `ScenarioApiService`. Update `ScenarioFormComponent` to inject it. Build.
5. Move `WorldSyncService` to `chat/`. Update `SessionService`. Build.
6. Delete `ai-assist.service.ts`. Confirm no import errors.

**Anti-pattern guards:**
- Do NOT create a new shared service to replace AiAssistService — that recreates the problem
- Copy the `AbortSignal.timeout(environment.timeoutMs)` pattern into each new service (L34, L90, L116, L207 in original)
- Keep HTTP error handling pattern identical to original (check how errors surface in original callAssist)

**Verification checklist:**
- [ ] `grep -r "AiAssistService\|ai-assist.service" apps/llama-chat/src/` — zero results
- [ ] `npx nx build llama-chat` passes
- [ ] `npx nx test llama-chat` passes
- [ ] DM NPC generation, scenario generation, chat input assist all work (manual test or check specs)

---

## Phase 4: Scaffold Nx Library Shells

**Context for executor:** In-app decomposition complete (Phases 1-3 done). Now scaffold the Nx library shell projects. No file moves yet — just create the project scaffolding.

**Tasks:**

1. Read `node_modules/@nx/angular/PLUGIN.md` if it exists. If not: run `npx nx g @nx/angular:library --help` and capture available flags. Confirm `--buildable` is a valid flag for Nx 22.5.2.

2. Read `nx.json` and `tsconfig.base.json` — note existing path alias format and any generator defaults.

3. Generate all 10 libraries:

```bash
# Shared libs
npx nx g @nx/angular:library shared-world-state \
  --directory=libs/shared/world-state \
  --tags='scope:shared,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library shared-scenario \
  --directory=libs/shared/scenario \
  --tags='scope:shared,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library shared-settings \
  --directory=libs/shared/settings \
  --tags='scope:shared,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library shared-ui \
  --directory=libs/shared/ui \
  --tags='scope:shared,lang:angular' \
  --standalone --no-routing --buildable

# Feature libs
npx nx g @nx/angular:library feature-chat \
  --directory=libs/feature-chat \
  --tags='scope:feature,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library feature-dm \
  --directory=libs/feature-dm \
  --tags='scope:feature,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library feature-combat \
  --directory=libs/feature-combat \
  --tags='scope:feature,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library feature-journal \
  --directory=libs/feature-journal \
  --tags='scope:feature,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library feature-settings \
  --directory=libs/feature-settings \
  --tags='scope:feature,lang:angular' \
  --standalone --no-routing --buildable

npx nx g @nx/angular:library feature-scenario \
  --directory=libs/feature-scenario \
  --tags='scope:feature,lang:angular' \
  --standalone --no-routing --buildable
```

4. After generation, verify `tsconfig.base.json` has path aliases for all 10 libs (Nx adds these automatically):
   - `@nx-monorepo-experiment/shared-world-state` → `libs/shared/world-state/src/index.ts`
   - etc.

5. Update `apps/llama-chat` tags in `apps/llama-chat/project.json` to `scope:app,lang:angular`.

**Anti-pattern guards:**
- Do NOT use `--module` flag (no NgModules)
- Do NOT use `--routing` flag (routing stays in shell app)
- Do NOT use `--publishable` (internal libs only — use `--buildable`)
- Check `--help` output before running if unsure about flag names — do not guess

**Verification checklist:**
- [ ] `ls libs/shared/` shows `world-state/`, `scenario/`, `settings/`, `ui/`
- [ ] `ls libs/` shows `feature-chat/`, `feature-dm/`, `feature-combat/`, `feature-journal/`, `feature-settings/`, `feature-scenario/`
- [ ] Each lib has `project.json` with correct tags
- [ ] `tsconfig.base.json` has 10 new path aliases
- [ ] `npx nx run-many -t build` passes (nothing moved yet — all libs build as empty stubs)
- [ ] `npx nx graph` shows 10 new project nodes

---

## Phase 5: Extract Shared Libraries

**Context for executor:** Nx library shells exist (Phase 4 done). Move source files from `apps/llama-chat/src/app/` into `libs/shared/*/src/lib/`. Update import paths throughout the app. Do NOT touch feature folders yet.

**Files to move:**

### → `libs/shared/world-state/src/lib/`

From `apps/llama-chat/src/app/world-state/`:
- `world-state.model.ts` (root aggregate)
- `combat.model.ts`, `npc.model.ts`, `quest.model.ts`, `bond.model.ts`, `player.model.ts`, `faction.model.ts`, `story.model.ts` (domain models from Phase 1)
- `world-state.store.ts` (from Phase 2)
- `world-state.service.ts` (facade from Phase 2)
- `npc-state.service.ts`, `quest-state.service.ts`, `player-state.service.ts`, `faction-state.service.ts` (from Phase 2)
- `bond-state.service.ts` (temporary — moves to feature-chat in Phase 6)
- `combat-state.service.ts` (temporary — moves to feature-combat in Phase 6)

From `apps/llama-chat/src/app/shared/`:
- `storage.service.ts`

`libs/shared/world-state/src/index.ts` exports:
```typescript
// Models
export * from './lib/world-state.model';
export * from './lib/combat.model';
export * from './lib/npc.model';
export * from './lib/quest.model';
export * from './lib/bond.model';
export * from './lib/player.model';
export * from './lib/faction.model';
export * from './lib/story.model';
// Services
export { WorldStateStore } from './lib/world-state.store';
export { WorldStateService } from './lib/world-state.service';
export { NpcStateService } from './lib/npc-state.service';
export { QuestStateService } from './lib/quest-state.service';
export { PlayerStateService } from './lib/player-state.service';
export { FactionStateService } from './lib/faction-state.service';
export { BondStateService } from './lib/bond-state.service';
export { CombatStateService } from './lib/combat-state.service';
export { StorageService } from './lib/storage.service';
```

### → `libs/shared/scenario/src/lib/`

From `apps/llama-chat/src/app/scenario/`:
- `scenario.model.ts`
- `scenario.service.ts`

### → `libs/shared/settings/src/lib/`

From `apps/llama-chat/src/app/shared/`:
- `settings.service.ts`

### → `libs/shared/ui/src/lib/`

From `apps/llama-chat/src/app/shared/`:
- `error-boundary.component.ts`
- `app-error.service.ts`
- `loading-bus.service.ts`

**Import update process:**
After each lib move, run grep to find all broken imports and fix to use Nx path alias:
```bash
# Find callers of moved files (run before each move)
grep -r "from '.*world-state" apps/llama-chat/src/ --include="*.ts" -n
grep -r "from '.*storage.service'" apps/llama-chat/src/ --include="*.ts" -n
grep -r "from '.*scenario.service\|from '.*scenario.model'" apps/llama-chat/src/ --include="*.ts" -n
grep -r "from '.*settings.service'" apps/llama-chat/src/ --include="*.ts" -n
grep -r "from '.*error-boundary\|from '.*app-error\|from '.*loading-bus'" apps/llama-chat/src/ --include="*.ts" -n
```

Old import: `import { WorldStateService } from '../world-state/world-state.service'`
New import: `import { WorldStateService } from '@nx-monorepo-experiment/shared-world-state'`

**Build after each lib extraction** (not just at the end):
```bash
npx nx build shared-world-state && npx nx build llama-chat
```

**Verification checklist:**
- [ ] `npx nx build shared-world-state` passes
- [ ] `npx nx build shared-scenario` passes
- [ ] `npx nx build shared-settings` passes
- [ ] `npx nx build shared-ui` passes
- [ ] `npx nx build llama-chat` passes
- [ ] `npx nx serve llama-chat` — app starts, all routes load

---

## Phase 6: Extract Feature Libraries

**Context for executor:** All shared libs extracted (Phase 5 complete and verified). Now move feature folders into their Nx libs. Features can be extracted in any order — they don't depend on each other. Each feature only imports from `@nx-monorepo-experiment/shared-*`.

**File move map:**

### `feature-chat` (`libs/feature-chat/src/lib/`)

From `apps/llama-chat/src/app/chat/`:
- `chat.component.ts`, `chat.component.html`, `chat.component.scss`
- `chat.service.ts`
- `chat-assist.service.ts` (created in Phase 3)

From `apps/llama-chat/src/app/session/`:
- `session.service.ts`

From `apps/llama-chat/src/app/chat/` (moved from world-state in Phase 2):
- `world-sync.service.ts`

From `apps/llama-chat/src/app/world-state/world-panel/`:
- `world-panel.component.ts`, `.html`

**Also move:** `bond-state.service.ts` from `shared-world-state` to `feature-chat` lib src. Update `shared-world-state/src/index.ts` to remove its export. Update `WorldStateService` injection of `BondStateService` to import from `feature-chat` — **WAIT**: this creates `shared-world-state → feature-chat` circular dep.

**Resolution:** `BondStateService` stays in `shared-world-state`. Bond mutations are triggered by `applyDelta()` (from LLM response), which is in `WorldStateService` (shared). Moving it to feature-chat would violate the boundary. Accept it as shared (interpersonal mode is a first-class app concept, not feature-private).

Export from `libs/feature-chat/src/index.ts`:
```typescript
export { ChatComponent } from './lib/chat/chat.component';
```

### `feature-dm` (`libs/feature-dm/src/lib/`)

From `apps/llama-chat/src/app/dm/`:
- `dm.component.ts`, `.html`, `.scss`
- `dm.model.ts`
- `dm-npc-adapter.ts`
- `dm-api.service.ts` (created in Phase 3)
- `session-zero/session-zero.component.ts`, `.html`, `.scss`

Export from index.ts: `DmComponent`, `SessionZeroComponent`.

### `feature-combat` (`libs/feature-combat/src/lib/`)

From `apps/llama-chat/src/app/combat/`:
- `combat.component.ts`, `.html`, `.scss`
- `combat.service.ts`
- `action-panel/action-panel.component.ts`
- `combat-log/combat-log.component.ts`
- `initiative-tracker/initiative-tracker.component.ts`

**Also move:** `combat-state.service.ts` from `shared-world-state` to `feature-combat`. Same circular dep risk as BondStateService — check whether `WorldStateService.applyDelta()` calls `CombatStateService`. If yes, `combat-state.service.ts` stays in `shared-world-state` too.

Export from index.ts: `CombatComponent`.

### `feature-journal` (`libs/feature-journal/src/lib/`)

From `apps/llama-chat/src/app/journal/`:
- `journal.component.ts`, `.html`

Export from index.ts: `JournalComponent`.

### `feature-settings` (`libs/feature-settings/src/lib/`)

From `apps/llama-chat/src/app/settings/`:
- `settings.component.ts`, `.html`, `.scss`

**Note:** `SettingsService` stays in `shared-settings`. `SettingsComponent` imports `SettingsService` from `@nx-monorepo-experiment/shared-settings`.

Export from index.ts: `SettingsComponent`.

### `feature-scenario` (`libs/feature-scenario/src/lib/`)

From `apps/llama-chat/src/app/scenario/scenario-form/`:
- `scenario-form.component.ts`, `.html`, `.scss`

From `apps/llama-chat/src/app/scenario/`:
- `preset-scenario.service.ts`
- `scenario-api.service.ts` (created in Phase 3)

Export from index.ts: `ScenarioFormComponent`.

**Per-feature process:**
1. Move files.
2. Fix all imports to use `@nx-monorepo-experiment/shared-*` aliases.
3. Verify zero cross-feature imports: `grep -r "@nx-monorepo-experiment/feature-" libs/feature-<name>/src/`
4. Build: `npx nx build feature-<name>`
5. Verify app still serves: `npx nx build llama-chat`

**Update `app.routes.ts`** after all features extracted:
```typescript
// Before:
{ path: 'chat', loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent) }

// After:
{ path: 'chat', loadComponent: () => import('@nx-monorepo-experiment/feature-chat').then(m => m.ChatComponent) }
```

**Verification checklist (per feature):**
- [ ] `npx nx build feature-<name>` passes
- [ ] `npx nx test feature-<name>` passes
- [ ] Zero cross-feature imports in lib src
- [ ] `npx nx serve llama-chat` — route loads correctly

---

## Phase 7: Shell Cleanup

**Context for executor:** All features in libs. Shell app should be nearly empty.

**Tasks:**
1. Verify `apps/llama-chat/src/app/` has ONLY: `app.routes.ts`, `app.config.ts`, `app.ts`, `app.html`, `app.scss`, `app.spec.ts`
2. Delete any leftover empty folders under `apps/llama-chat/src/app/`.
3. Update `apps/llama-chat` tags in `project.json`: `scope:app,lang:angular`.
4. `app.ts` imports `ErrorBoundaryComponent` from `@nx-monorepo-experiment/shared-ui`.
5. Run `npx nx graph` — verify clean topology.

**Verification checklist:**
- [ ] `apps/llama-chat/src/app/` ≤ 6 files
- [ ] `npx nx build llama-chat` passes
- [ ] `npx nx e2e llama-chat-e2e` passes (Playwright hits served URL, unaffected by lib moves)
- [ ] `npx nx graph` topology: `app → feature-* → shared-*` (no direct app→shared except shared-ui for ErrorBoundary in app.ts)

---

## Phase 8: Enforce Module Boundaries

**Context for executor:** All code in libs, shell clean. Enable Nx boundary lint rule to make violations compile-time errors.

**Tasks:**

1. Read the root ESLint config (check for `eslint.config.js` or `eslint.config.mjs` — Nx 22 uses flat config by default):
   ```bash
   ls *.eslint* eslint.config* 2>/dev/null
   ```

2. Find `@nx/enforce-module-boundaries` rule. Add `depConstraints`:
   ```javascript
   // In eslint.config.js / .eslintrc.json
   {
     sourceTag: 'scope:feature',
     onlyDependOnLibsWithTags: ['scope:shared']
   },
   {
     sourceTag: 'scope:shared',
     onlyDependOnLibsWithTags: ['scope:shared']
   },
   {
     sourceTag: 'scope:app',
     onlyDependOnLibsWithTags: ['scope:feature', 'scope:shared']
   }
   ```

3. Run `npx nx run-many -t lint`. Fix any violations reported (expected: zero, since we enforced boundaries manually during extraction).

4. Run full verification: `npx nx run-many -t build test lint`

5. Smoke-test boundary enforcement: add a fake cross-feature import to `feature-chat`, confirm lint errors, then revert.

**Verification checklist:**
- [ ] `npx nx run-many -t lint` — zero errors
- [ ] `npx nx run-many -t build` — all 10 libs + app build
- [ ] `npx nx run-many -t test` — all tests pass
- [ ] Cross-feature import deliberately added → lint fails with boundary error → revert
- [ ] `npx nx affected -t test --base=HEAD~1` — correctly scopes after touching one lib

---

## Expected Outcome

| Before | After |
|--------|-------|
| 52-file monolith, 1 Nx project | 1 shell app + 10 libs, 11 Nx projects |
| WorldStateService: 713 lines | WorldStateStore: ~100, facade: ~200, 6 domain services: ~80 each |
| AiAssistService: shared grab-bag | Dissolved — 3 feature-owned services |
| SettingsService: could end up in wrong lib | In `shared-settings`, boundary-safe |
| `nx affected` re-tests everything always | Scoped: touch `shared-world-state` → re-tests 5 affected libs, skips 5 |
| AI reads 52 files for any task | AI reads 5-10 files for any scoped task |
| Boundary violations possible | Boundary violations = lint error |

---

## Risk Notes

- **`applyDelta()` decomposition complexity:** `applyDelta()` at L148-353 is the riskiest change in Phase 2. Read it fully before touching it. Run tests after each domain service extraction, not just at the end.
- **`BondStateService` and `CombatStateService` placement:** These start in `shared-world-state` for Phase 5. Evaluate in Phase 6 whether they can move to feature libs without creating a `shared → feature` back-reference. If they can't, they stay shared — that's acceptable.
- **Schema migrations (L675-711):** Stay in `WorldStateStore`. No logic change.
- **localStorage keys unchanged:** `'llama-scenario'`, `'llama_chat_messages'`, `'llm_active_backend_id'` etc. — no data loss.
- **E2E tests (Playwright):** Target served URL — unaffected by lib extraction.
- **Proxy config:** Stays in shell app — no change.
