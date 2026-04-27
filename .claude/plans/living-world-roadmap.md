# Living Story Engine — Full Roadmap

*Synthesized from System Architect + World Building expert analysis, 2026-04-27*

---

## Vision Statement

Transform this local LLM chat app into a **Living Story Engine** — a platform where the world remembers, NPCs act, time passes, and player choices accumulate into a story that earns its ending. The local LLM is not a limitation; it is a collaborator that never sleeps and remembers everything you tell it.

---

## Mode Taxonomy (Final Naming)

| Mode | Route | Narrative Contract |
|---|---|---|
| **Wanderer** | `/chat` (adventure) | You are in a world that doesn't care about you — yet. Your choices leave marks. |
| **Bond** | `/chat` (interpersonal) | You are in a relationship. What you say matters. What you remember matters more. |
| **Architect** | `/dm` | You are building something. The AI proposes; you decide. |
| **Legend** | layered atop Wanderer/Bond | This story has a past. You carry it with you. |
| **Combat** | `/combat` | NEW — structured encounter with initiative, HP, turn-based resolution. |
| **Journal** | `/journal` | NEW — read-only view of quest log, event timeline, session summaries. |

---

## Phase 0: Documentation Discovery (ALWAYS FIRST when implementing)

When implementing any phase below, the executing agent must:

1. Read `apps/llama-chat/src/app/world-state/world-state.model.ts` — canonical TS types
2. Read `apps/llama-proxy/models.py` — canonical Pydantic models  
3. Read `apps/llama-chat/src/app/world-state/world-state.service.ts` — mutation patterns
4. Read `apps/llama-proxy/routes/generate.py` — existing route patterns to copy
5. Read `apps/llama-chat/src/app/chat/chat.component.ts` — existing signal patterns
6. Verify `_schemaVersion` in both TS and Python before any model changes
7. Check `apps/llama-chat/src/app/app.routes.ts` for routing patterns

Anti-patterns to avoid:
- Never let TypeScript model and Pydantic model drift out of sync
- Never invent LLM endpoints that aren't in the existing route files
- Never use localStorage directly — go through WorldStateService
- Never add `@NgModule` — all components are standalone

---

## Phase 1: Foundation Hardening

**Goal:** Fix technical debt. All existing functionality works better. No new UI modes.

**Duration:** 2–3 days. Fully shippable.

### 1a. WorldState Schema v2 — Clock + Index

**Files to change:**
- `apps/llama-chat/src/app/world-state/world-state.model.ts`
- `apps/llama-chat/src/app/world-state/world-state.service.ts`
- `apps/llama-proxy/models.py`
- `apps/llama-proxy/routes/generate.py` (world-state update endpoint)

**Changes:**
- Change `WorldStateDelta.clockAdvance: boolean` → `ClockAdvance | null` where `ClockAdvance = { turns: number }`. `turns >= worldClock.turnsPerDay` triggers day rollover; `turns < turnsPerDay` advances time-of-day cyclically.
- Bump `_schemaVersion` to `2`. Add migration in `WorldStateService.migrate()`.
- Replace localStorage scan loop in `loadForScenario()` with indexed lookup. Add a separate key `llama-world-index` holding `{ id: string, title: string, lastUpdated: string }[]`. Load/save this index on every `persistNow()`.
- Mirror `ClockAdvance` in `models.py` as `class ClockAdvance(BaseModel): turns: int = 1`.

**Verification:**
- `grep -n "clockAdvance" apps/llama-chat/src/app/world-state/world-state.model.ts` → must show `ClockAdvance | null`
- `grep -n "llama-world-index" apps/llama-chat/src/app/world-state/world-state.service.ts` → must exist
- `npx nx test llama-chat` — no regressions

### 1b. SessionService Extraction

**Files to create/change:**
- `apps/llama-chat/src/app/session/session.service.ts` (NEW)
- `apps/llama-chat/src/app/chat/chat.component.ts` (remove `_deltaEffect` hack)

**Changes:**
- Create `SessionService` (providedIn: 'root') with:
  ```typescript
  readonly mode = signal<'adventure' | 'interpersonal' | 'combat' | 'journal'>('adventure');
  onTurnComplete(lastMessage: string): Promise<void>   // fires world-state update
  maybeSummarize(turnCount: number): Promise<void>    // every 20 turns
  ```
- Move `triggerWorldStateUpdate()` from `ChatComponent` into `SessionService.onTurnComplete()`.
- `ChatComponent._deltaEffect` becomes: `sessionService.onTurnComplete(lastAssistantMsg)`.

**Verification:**
- `grep -n "triggerWorldStateUpdate" apps/llama-chat/src/app/chat/chat.component.ts` → must NOT exist
- `grep -n "onTurnComplete" apps/llama-chat/src/app/session/session.service.ts` → must exist

### 1c. AiAssistService Split

**Files to create/change:**
- `apps/llama-chat/src/app/shared/world-sync.service.ts` (NEW — extracted from AiAssistService)
- `apps/llama-chat/src/app/shared/ai-assist.service.ts` (remove world-state calls)

**Changes:**
- `WorldSyncService` owns the `POST /world-state/update` call and `POST /world-state/summary` (Phase 2).
- `AiAssistService` owns only `POST /assist` (suggest/rewrite).
- Add proper-noun pre-filter to `WorldSyncService.shouldTriggerUpdate(lastMessage, worldState)`:
  build a `Set` of NPC names + faction names + location names; return `false` if no names match. Saves ~30% of world-state LLM calls on descriptive-only turns.

### 1d. WorldPanel Extraction

**Files to create/change:**
- `apps/llama-chat/src/app/world-state/world-panel/world-panel.component.ts` (NEW)
- `apps/llama-chat/src/app/world-state/world-panel/world-panel.component.html` (NEW)
- `apps/llama-chat/src/app/chat/chat.component.html` (remove inline world panel)

**Changes:**
- Extract the world panel `@if (showWorldPanel())` block from `chat.component.html` into `WorldPanelComponent`.
- `@Input() worldState: WorldState`, `@Input() activeTab: string`, `@Output() tabChange`.
- Makes it reusable in future `JournalComponent`.

### 1e. Backend Route Reorganization

**Files to create/change:**
- `apps/llama-proxy/routes/world_state.py` (NEW — extract from generate.py)
- `apps/llama-proxy/routes/generate.py` (remove world-state update endpoint)
- `apps/llama-proxy/main.py` (add world_state router)

**Changes:**
- Move `POST /world-state/update` from `generate.py` to `world_state.py`.
- Add `context_window: int = 8192` to each backend config dict in `config.py`.
- Expose `context_window` in `GET /config/backends` response.
- Angular `SettingsService` reads `contextWindow` and exposes as signal; `ChatService.contextWarning` threshold = `contextLimit() * 0.5`.

---

## Phase 2: Persistence + DM Integration + Quest Log

**Goal:** Sessions survive browser restarts reliably. DM tools connect to WorldState. Quest log exists.

**Duration:** 3–5 days. Fully shippable.

### 2a. StorageService (IndexedDB)

**Files to create/change:**
- `apps/llama-chat/src/app/shared/storage.service.ts` (NEW)
- `apps/llama-chat/src/app/world-state/world-state.service.ts` (use StorageService)
- `apps/llama-chat/src/app/chat/chat.service.ts` (use StorageService)

**Implementation:**
```typescript
@Injectable({ providedIn: 'root' })
export class StorageService {
  async save(key: string, value: unknown): Promise<void>
  async load<T>(key: string): Promise<T | null>
  async listByPrefix(prefix: string): Promise<{ key: string }[]>
  async delete(key: string): Promise<void>
}
```
Backed by `idb` npm package (`npm install idb`). localStorage-backed initially behind the same interface — switch to IndexedDB as the backing store. All WorldStateService and ChatService localStorage calls migrate to StorageService.

### 2b. WorldState v2 — QuestEntry + PlayerCharacter

**Add to model:**
```typescript
export interface QuestEntry {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  objectives: { text: string; done: boolean }[];
  addedAtTurn: number;
  resolvedAtTurn?: number;
  linkedNpcIds: string[];
  rewards?: { gold?: number; items?: string[] };
}

export interface PlayerCharacter {
  name: string;
  epithets: string[];           // "Known to keep their word", "Feared by the Crimson Pact"
  aptitudes: {                  // 0-5 pips each
    bold: number; subtle: number; learned: number;
    connected: number; fierce: number; resilient: number;
  };
  scarsAndGlories: string[];   // permanent marks
  inventory: string[];
  conditions: string[];
  hp: { current: number; max: number };
}
```

Add to `WorldState`:
- `questLog: QuestEntry[]`
- `playerCharacter: PlayerCharacter | null`
- `choiceChronicle: string[]`  — top-3 consequential choices per session
- `storyBeat: 'inciting_incident' | 'rising_tension' | 'dark_moment' | 'climax_pending' | 'resolution' | null`

Add to `WorldStateDelta`:
- `questUpdates: QuestUpdate[]`
- `playerUpdate: PlayerUpdate | null`
- `storyBeatUpdate: WorldState['storyBeat'] | null`
- `epithetGains: string[]`
- `aptitudePips: Partial<PlayerCharacter['aptitudes']>`

Mirror all in `models.py`.

### 2c. Export/Import (Browser-side, no backend)

Add to `WorldStateService`:
```typescript
async exportToFile(): Promise<void>   // JSON blob → browser download
async importFromFile(file: File): Promise<boolean>
```
UI: small "Export / Import" button in SettingsComponent. Zero backend changes.

### 2d. DM → WorldState Promotion

**Files to change:**
- `apps/llama-chat/src/app/dm/dm.component.html` (add "Promote to World" button)
- `apps/llama-chat/src/app/dm/dm.component.ts` (add promote actions)
- Create `apps/llama-chat/src/app/dm/dm-npc-adapter.ts` (DmNpc → NpcState)

```typescript
// dm-npc-adapter.ts
export function dmNpcToNpcState(dmNpc: DmNpc): NpcState {
  return {
    npcId: dmNpc.id,
    name: dmNpc.name,
    status: 'alive',
    disposition: 0,
    relationships: [],
    knownFacts: [],
    notes: `${dmNpc.personality} | CR ${dmNpc.cr}`,
    locationId: undefined,
  };
}
export function dmQuestToQuestEntry(quest: Quest): QuestEntry {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    status: 'active',
    objectives: quest.objectives.map(o => ({ text: o, done: false })),
    addedAtTurn: 0,
    linkedNpcIds: [],
    rewards: { gold: quest.rewards.gold, items: quest.rewards.items },
  };
}
```

"Promote to World" button only visible when `scenarioService.activeScenario()` is non-null.

### 2e. JournalComponent

**Files to create:**
- `apps/llama-chat/src/app/journal/journal.component.ts`
- `apps/llama-chat/src/app/journal/journal.component.html`

Route: `/journal`. Lazy-loaded.

Tabs: **Quest Log** | **Event Timeline** | **Session Summaries** | **Character**

- Quest Log: lists `questLog` by status. Objectives checkable (updates WorldState).
- Event Timeline: lists `storyEvents` chronologically with certainty icons.
- Session Summaries: lists `sessionSummaries` as "Previously on..." cards.
- Character: shows epithets, aptitude pips (visual), scars & glories, inventory.

### 2f. Session Summary Wiring

- `POST /world-state/summary` endpoint in `world_state.py` — input: last 20 messages + compact world state; output: `SessionSummary { summary, keyFacts }`.
- `SessionService.maybeSummarize()` fires every 20 turns. On success: `WorldStateService.addSessionSummary()`.
- When `storyEvents` archives past 50, populate `archivedEventSummary` from oldest session summary.

---

## Phase 3: Living World + Narrative Mechanics

**Goal:** World acts without the player. Sessions have structure. Narrative feels consequential.

**Duration:** 3–4 days. Fully shippable.

### 3a. Heartbeat System (World Tick)

On every `direct` action or scene transition, `SessionService` fires a **world tick**:

1. **NPC Drift** — For NPCs with `|disposition| >= 40`, 30% chance they acted off-screen. If triggered, call `POST /world-state/npc-rumor` with the NPC + current world state. LLM returns a 1-sentence rumored event. Stored as `certainty: 'rumored'` in `storyEvents`.

2. **Faction Pressure** — Factions drift `±3` toward neutral each tick unless anchored by recent player action (event in last 5 turns involving that faction). Two factions with conflicting interests and both `standing > 20` get a flag `standingConflict: true` — LLM uses this flag to generate a pressure event.

3. **Ambient Injection** — One ambient detail injected as the opening line of the next narrative. Pool seeded from: current location, season, time of day, scene tension. Stored in `WorldState.ambientQueue: string[]` (max 3; consumed FIFO).

**New endpoint:** `POST /world-state/tick` — input: world state + scenario; output: `{ rumor: StoryEvent | null, ambientLine: string }`.

### 3b. Story Beat Detection

After each `WorldStateDelta` is applied, `SessionService` re-evaluates `storyBeat`:
- `inciting_incident`: turn 1–5 with a `witnessed` event
- `rising_tension`: faction standing changed ≥15 in last 5 turns OR NPC disposition changed ≥25
- `dark_moment`: player HP < 30% OR 2+ factions hostile
- `climax_pending`: 2+ major threads converging (multiple faction conflicts active)
- `resolution`: major conflict resolved (standing stabilized, key hostile NPC dead)

Beat is included in system prompt to LLM as 1-line prefix. LLM narrates `dark_moment` differently than `rising_tension`.

### 3c. Reputation Sheet UI

Add `PlayerCharacter` display to `WorldPanelComponent` (new tab: "Character"). Show:
- **Epithets** as pill badges (max 5 active)
- **Aptitudes** as 6 bars (0–5 pips). Bold / Subtle / Learned / Connected / Fierce / Resilient
- **Scars & Glories** as list (permanent, never fade)

After each session: LLM prompted in `POST /world-state/summary` to suggest 1–2 aptitude pips + 0–1 epithets based on session events. Surfaced in JournalComponent "Character" tab for player confirmation.

### 3d. Choice Chronicle

After each world-state delta, detect **consequential moments**: NPC disposition changed ≥15 OR faction standing changed ≥15. Cap at top-3 per session. Store in `WorldState.choiceChronicle[]`. Display in JournalComponent.

### 3e. Tone Controls

Add to `SettingsComponent` (and persist to localStorage):
```typescript
interface ToneSettings {
  pacing: 'cinematic' | 'deliberate';      // default: deliberate
  register: 'gritty' | 'balanced' | 'mythic';  // default: balanced
  boundary: 'fade' | 'standard' | 'unfiltered'; // default: standard
}
```
These map to injected phrases in the system prompt builder. Pass through `ChatRequest.tone_settings` to proxy.

### 3f. Bond Mode Engine (Interpersonal overhaul)

Interpersonal mode gets its own `BondState` within WorldState when `scenario.scenarioType === 'interpersonal'`:

```typescript
export interface BondState {
  tier: 0 | 1 | 2 | 3 | 4 | 5;              // Stranger → Bonded
  temperature: 'cold' | 'warm' | 'charged' | 'tender' | 'raw';
  memoryAnchors: { id: string; description: string; playerInvoked: boolean }[];
  milestones: string[];                        // "First argument", "First confession"
  companionMood: string;                       // free text, updated by LLM
}
```

New `InputType` values for Bond mode: `say` | `do` | `feel` | `remember`.

`remember` input type: player invokes a named memory anchor. System prompt includes that anchor + companion's current emotional relationship to it.

Interpersonal `WorldStateDelta` includes: `bondUpdate: { tierDelta?, temperatureChange?, newMilestone?, newAnchor? }`.

---

## Phase 4: Error Handling + Context Management

**Goal:** Long sessions remain coherent. Errors are graceful, not silent.

**Duration:** 2–3 days. Fully shippable.

### 4a. AppError + ErrorBoundary

```typescript
type AppError =
  | { type: 'llm_unreachable'; message: string }
  | { type: 'parse_failure'; message: string }
  | { type: 'quota_exceeded'; message: string }
  | { type: 'abort'; message: string };
```

Wire `ErrorBoundaryComponent` (already exists but unused) into all lazy-loaded routes via Angular error handling. Each error type renders different recovery UI.

### 4b. LoadingBusService

```typescript
@Injectable({ providedIn: 'root' })
export class LoadingBusService {
  readonly chatLoading = computed(...)
  readonly worldUpdateLoading = computed(...)
  readonly assistLoading = computed(...)
  readonly anyLoading = computed(...)
  set(key: string, value: boolean): void
}
```

Replace all scattered `loading` signals in services.

### 4c. Tiered Context Management

- **Auto-archive at 50% context limit**: fold oldest 25% of messages into latest session summary invisibly.
- **Warning banner at 75%**: show 3 actions — "Trim", "Export & Reset", "Continue anyway".
- **System prompt token accounting**: `ChatService.systemPromptTokenEstimate` signal, fed from first `/chat` response `usage.prompt_tokens` if llama.cpp returns it, else estimated from scenario field lengths.
- **Improved trimContext**: show preview count before confirming. Add `keepLast` slider.

### 4d. Enhanced Contradiction Detection

Extend `WorldStateService.detectContradictions()`:
- Dead NPCs appearing in narrative (existing)
- NPC appearing in location they're not assigned to (new heuristic — regex pattern `NpcName.*OtherLocation`)
- Keep client-side only. No LLM calls for contradiction detection.

---

## Phase 5: Combat Mode

**Goal:** Structured turn-based combat when scene tension reaches 'combat'.

**Duration:** 5–7 days. Fully shippable.

### 5a. CombatState Model

Add to `WorldState`:
```typescript
export interface CombatState {
  active: boolean;
  round: number;
  initiativeOrder: {
    entityId: string; name: string; initiative: number;
    hp: { current: number; max: number }; isPlayer: boolean;
  }[];
  activeEntityIndex: number;
  log: string[];
}
```

Add `CombatDelta` to `WorldStateDelta`:
```typescript
export interface CombatDelta {
  action: 'start' | 'next_turn' | 'end';
  hpChanges?: { entityId: string; hpDelta: number }[];
  roundLogAppend?: string;
  removedEntityIds?: string[];
}
```

### 5b. CombatService

```typescript
@Injectable({ providedIn: 'root' })
export class CombatService {
  readonly combatActive = computed(...)
  readonly initiative = computed(...)
  async startCombat(participantNpcIds: string[]): Promise<void>
  async resolveTurn(action: string): Promise<void>
  async endCombat(outcome: 'victory' | 'flee' | 'tpk'): Promise<void>
}
```

Dice rolling: client-side JS (`Math.random()` + stat modifiers) for mechanical resolution. LLM used only for narrative description of the result. Keeps combat fast and deterministic.

Auto-transition: when `WorldStateDelta` sets `scene.tension === 'combat'`, prompt user "A fight is breaking out — enter combat mode?" If confirmed, navigate to `/combat` and call `CombatService.startCombat()`.

### 5c. Backend Combat Endpoint

`POST /combat/resolve-turn` in new `routes/combat.py`:
- Input: `CombatResolveRequest { scenario, world_state, combat_state, action_text, active_entity_id }`
- Output: `CombatResolution { narrative: str, hp_changes: [...], status_changes: [...], round_end: bool }`
- Temperature: 0.1. JSON mode. 30s timeout.
- Use `CombatPromptBuilder` (implements `PromptBuilder` protocol) — tight structured prompt, not GM narrative prompt.

### 5d. CombatComponent

Route: `/combat`. Three sub-components:
- `InitiativeTrackerComponent` — show turn order, HP bars, highlight active entity
- `CombatLogComponent` — scrolling LLM narrative log
- `ActionPanelComponent` — action input, quick actions (attack/dodge/flee/spell)

On `endCombat()`: navigate back to `/chat`, apply `CombatDelta` outcomes (deaths → NpcState status, XP → PlayerCharacter).

---

## Phase 6: Session Zero + DM Campaign Forge

**Goal:** DM mode becomes a full campaign preparation tool.

**Duration:** 3–5 days. Fully shippable.

### 6a. Session Zero Flow

New route: `/dm/session-zero`. Wizard:
1. Generate world premise (genre, tone, inciting crisis) — `POST /generate-scenario`
2. Generate 3 factions with conflicting goals — `POST /generate-faction-set` (new)
3. Generate 2–4 NPCs per faction — `POST /generate-npc` × N
4. Generate opening scene — `POST /generate-opening-scene` (new)
5. Export as complete scenario JSON — downloadable, importable into `/scenario/:mode`

### 6b. In-Session Oracle Mode

Quick-generation overlay in `ChatComponent`. Keyboard shortcut opens a minimal "Oracle" panel:
- Generate NPC name + 1-line description (50ms, tiny prompt)
- Generate location name + atmosphere
- Generate improvised quest hook from current world state
- Single-prompt, fast, no decision overhead — results injected into current scene note

### 6c. Preset Scenario Library

Expand `PresetScenarioService` with 3–5 rich presets that include:
- Pre-populated NPCs (with world-state NpcState entries)
- Faction setup
- Opening quest seed
- Suggested opening scene

---

## Cross-Cutting Technical Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Persistence | IndexedDB via `idb` (Phase 2) | localStorage quota risk at complex WorldState |
| Combat resolution | Client dice + LLM narrative only | Speed + determinism; LLM slow for math |
| World-state update trigger | Proper-noun pre-filter | Eliminates ~30% unnecessary LLM calls |
| Session summaries | Every 20 turns, background | Keeps context coherent without user friction |
| DM→WorldState bridge | Optional promotion, not forced | DM tools remain standalone; integration additive |
| Prompt world-state budget | 800 tokens, server-side enforced | Frontend-only `toCompactPrompt()` not actually used in prompts today |
| Clock advance | `ClockAdvance { turns: number }` | Enables time-of-day progression within a day |
| Error handling | `AppError` union + wired ErrorBoundary | Currently errors swallowed or console-only |
| Contradiction detection | Client-side heuristics only | No extra LLM calls; fast enough |
| Tone controls | 3 sliders → system prompt fragments | Demonstrably changes LLM output character |

---

## The Five Magic Moments (North Stars)

These must be deliverable when the plan is complete. If any cannot happen, design has failed.

1. **"They Remember"** — Player returns to a village from 3 sessions ago. NPC who was cold now greets them differently because WorldState recorded the player defended his daughter. The world noticed.

2. **"The Faction War Arrives"** — Player ignored rising faction tension for 2 sessions. Arrives at capital: streets wrong, wrong flags. The world moved without them. Inaction was also a choice.

3. **"She Said Something She Didn't Mean To"** — Bond mode, Tier 4, raw temperature: companion reveals vulnerability unprompted, then covers it. Player chooses: press or let it breathe.

4. **"The Epigraph"** — Session summary ends with one italicized line in the world's voice: *"The body was never found. The city forgot within a fortnight. Mira did not."* Players screenshot this.

5. **"The Aptitude Unlocked the Door"** — Player with Subtle 4 attempts infiltration others can't. No dice. LLM narrates it working because the character became that person. Not luck — growth.