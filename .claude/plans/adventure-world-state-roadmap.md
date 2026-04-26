# Roadmap: Living World Adventure Platform
> Reviewed by world-building / LLM systems expert. Supersedes prior version.

**Vision:** Transform from "stateless chat + scenario config" into a **living world engine** where world state evolves during play, the LLM reads and writes it, and the DM tools feed the adventure — not a separate mode.

---

## Current State (what exists)

| Layer | What it does | Gap |
|---|---|---|
| `ScenarioService` | Holds static `Scenario` (title, setting, NPCs, rules) | Static — never changes during play |
| `ChatService` | Streams chat, persists messages | No world awareness beyond scenario config |
| `DmComponent` | Generates NPCs + quests, saves to localStorage | **Completely disconnected from chat/adventure** |
| System prompt | Embeds scenario NPCs + rules | No factions, no event history, no NPC status, no spatial context |
| `/chat` endpoint | Returns narrative text | No structured state extraction |

**Root problem:** The LLM plays a world but knows nothing about what happened in it. Every `/chat` sends the full message history + static scenario — no living state.

---

## Phase 1 — World State Data Model

**Goal:** Define the complete `WorldState` data model and `WorldStateService`. No UI, no LLM integration — just the data layer. Include all fields from day one to avoid migration debt.

### `world-state.model.ts` (new file)

```typescript/
export type NpcStatus = 'alive' | 'dead' | 'missing' | 'unknown';
export type EventType = 'combat' | 'dialogue' | 'discovery' | 'faction' | 'world';
export type EventCertainty = 'witnessed' | 'rumored' | 'deduced' | 'false';
export type SceneTension = 'calm' | 'tense' | 'hostile' | 'combat';
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface Faction {
  id: string;
  name: string;
  description: string;
  archetypes: string[];       // e.g. ["merchants", "dock workers"] — for behavioral context
  standing: number;           // -100 (enemy) to +100 (allied)
  territories: string[];
  allies: string[];            // faction ids
  enemies: string[];           // faction ids
  notes: string;
}

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  factionControl?: string;     // faction id
  currentEvents: string[];
  visitCount: number;
}

export interface NpcRelationship {
  targetNpcId: string;
  disposition: number;         // -100 to +100
  note: string;                // "Betrayed Aldric at the guild meeting"
}

export interface NpcState {
  npcId: string;               // links to DmNpc.id or Npc.name
  name: string;
  status: NpcStatus;
  locationId?: string;
  disposition: number;         // -100 to +100 toward player
  relationships: NpcRelationship[];   // NPC-to-NPC (non-zero only)
  knownFacts: string[];        // facts player has learned about this NPC
  notes: string;
}

export interface StoryEvent {
  id: string;
  turn: number;
  title: string;               // ≤6 words
  description: string;
  type: EventType;
  certainty: EventCertainty;   // 'witnessed' = player saw it; 'rumored' = hearsay
  source?: string;             // "Yeva told me" / "player witnessed"
  involvedNpcIds: string[];
  involvedFactionIds: string[];
  locationId?: string;
}

export interface CurrentScene {
  locationId: string | null;
  presentNpcIds: string[];     // NPCs physically in the scene right now
  tension: SceneTension;
  sceneNote: string;           // "Negotiating with guild. Aldric blocking the door."
}

export interface WorldClock {
  dayNumber: number;           // in-world day counter
  timeOfDay: TimeOfDay;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  turnsPerDay: number;         // configurable; auto-advance dayNumber
}

export interface SessionSummary {
  id: string;
  turnRange: [number, number];
  summary: string;
  keyFacts: string[];          // max 10 entries — structured, not free text
  createdAt: string;
}

export interface WorldState {
  id: string;
  scenarioTitle: string;
  currentScene: CurrentScene | null;
  worldClock: WorldClock;
  factions: Faction[];
  locations: WorldLocation[];
  npcStates: NpcState[];
  storyEvents: StoryEvent[];
  keyFacts: string[];          // max 10 global canon facts — replaces free-text session_notes
  sessionSummaries: SessionSummary[];
  turnCount: number;
  lastUpdated: string;
}
```

### Backend Pydantic models — add to `models.py`

```python
class FactionState(BaseModel):
    id: str
    name: str
    archetypes: list[str] = []
    standing: int = 0           # -100 to +100
    territories: list[str] = []
    allies: list[str] = []
    enemies: list[str] = []
    notes: str = ""

class NpcRelationship(BaseModel):
    target_npc_id: str
    disposition: int = 0
    note: str = ""

class NpcStateModel(BaseModel):
    npc_id: str
    name: str
    status: Literal["alive", "dead", "missing", "unknown"] = "alive"
    location_id: str | None = None
    disposition: int = 0
    relationships: list[NpcRelationship] = []
    known_facts: list[str] = []
    notes: str = ""

class StoryEventModel(BaseModel):
    id: str
    turn: int
    title: str
    description: str
    type: Literal["combat", "dialogue", "discovery", "faction", "world"] = "world"
    certainty: Literal["witnessed", "rumored", "deduced", "false"] = "witnessed"
    source: str = ""
    involved_npc_ids: list[str] = []
    involved_faction_ids: list[str] = []
    location_id: str | None = None

class WorldLocation(BaseModel):
    id: str
    name: str
    description: str
    faction_control: str | None = None
    current_events: list[str] = []
    visit_count: int = 0

class CurrentScene(BaseModel):
    location_id: str | None = None
    present_npc_ids: list[str] = []
    tension: Literal["calm", "tense", "hostile", "combat"] = "calm"
    scene_note: str = ""

class WorldClock(BaseModel):
    day_number: int = 1
    time_of_day: Literal["dawn", "morning", "afternoon", "evening", "night"] = "morning"
    season: Literal["spring", "summer", "autumn", "winter"] = "spring"
    turns_per_day: int = 8

class WorldStateModel(BaseModel):
    id: str
    scenario_title: str
    current_scene: CurrentScene | None = None
    world_clock: WorldClock = WorldClock()
    factions: list[FactionState] = []
    locations: list[WorldLocation] = []
    npc_states: list[NpcStateModel] = []
    story_events: list[StoryEventModel] = []
    key_facts: list[str] = []
    turn_count: int = 0
```

### `WorldStateService` (`world-state.service.ts`)

```typescript
@Injectable({ providedIn: 'root' })
export class WorldStateService {
  readonly state = signal<WorldState | null>(null);

  // Init from scenario NPCs — called when adventure starts
  initForScenario(scenario: Scenario): void;

  // Apply LLM-returned delta (see Phase 3)
  applyDelta(delta: WorldStateDelta): void;

  // Manual CRUD
  updateFaction(id: string, patch: Partial<Faction>): void;
  updateNpcState(id: string, patch: Partial<NpcState>): void;
  updateScene(patch: Partial<CurrentScene>): void;
  addEvent(event: Omit<StoryEvent, 'id' | 'turn'>): void;

  // Token-budgeted prompt string — use this everywhere, never raw state
  toCompactPrompt(maxBudget = 600): string;

  // Contradiction check — scans narrative for dead NPC names
  detectContradictions(narrativeText: string): string[];

  private persist(): void;
  private load(): void;
}
```

**`toCompactPrompt()` priority order** (stops when budget reached):
1. Current scene (~20 tokens)
2. NPCs present in current scene + disposition (~15 tokens each)
3. Other alive NPCs (~10 tokens each)
4. Factions with standing ≠ 0 (~12 tokens each)
5. Last 3 witnessed events (~15 tokens each)
6. Suffix: `"... +N NPCs, +M events archived"` if truncated

**Storage key:** `'llama-world-state-{scenarioTitle}'`

### Verification
- Unit tests: `initForScenario`, `applyDelta`, `toCompactPrompt` budget respect, persist/load roundtrip
- `toCompactPrompt(200)` must never exceed ~200 tokens regardless of world size
- `grep -r "WorldState" src/` → model + service files only

---

## Phase 2 — World State in System Prompt

**Goal:** Inject world state into `build_system_prompt()` so the LLM GM treats it as authoritative ground truth.

### Key prompt engineering rules (apply all of these)

**Rule 1 — Ground-truth anchor.** Prepend the entire world state block with:
```
### WORLD STATE (AUTHORITATIVE — DO NOT CONTRADICT)
The following reflects what has actually happened in this story.
These are established facts. Do not invent events, resurrect dead characters,
or contradict established relationships. If unsure, stay silent on the detail.
```

**Rule 2 — Translate standing numbers to behavioral labels.** Add to `prompts.py`:
```python
def standing_label(v: int) -> str:
    if v >= 75:   return "allied"
    if v >= 40:   return "friendly"
    if v >= 10:   return "neutral-positive"
    if v >= -10:  return "neutral"
    if v >= -40:  return "unfriendly"
    if v >= -75:  return "hostile"
    return "enemy"
```
Inject factions as: `"- Iron Guild (hostile, -52): smugglers who control the docks."` — label + number together.

**Rule 3 — Separate dead NPCs completely.**  
Do NOT include dead NPCs in the "Active NPCs" section. Put them in a separate final block:
```
#### Deceased / Absent (do not include in scenes or dialogue)
- Guard Captain Aldric (DEAD — killed by player in turn 12)
```

**Rule 4 — Certainty qualifiers on rumored facts.** Render `StoryEvent.certainty`:
- `witnessed` → no qualifier
- `rumored` → prepend "Reportedly:"
- `deduced` → prepend "Evidence suggests:"
- `false` → omit entirely from prompt (it was disproven)

### Modify `build_system_prompt(scenario, world_state=None)` in `prompts.py`

Append when `world_state` is provided. Use `world_state.toCompactPrompt()` output — never inject raw state. Structure:

```
### WORLD STATE (AUTHORITATIVE — DO NOT CONTRADICT)
[anchor text]

**Current scene:** {location_name} — {tension} — {scene_note}
Present: {comma-separated NPC names}
Time: Day {day}, {time_of_day} ({season})

#### Active NPCs
[NPCs in scene first, then others by disposition]
- {name} ({standing_label(disposition)} toward player): {notes}
  [if relationships:] Relationships: hostile toward {name} ({note})

#### Factions
- {name} ({standing_label(standing)}, {standing:+d}): {description}. [{archetypes}]

#### Recent Events
[last 3 events, witnessed first]
- Turn {turn} — {title}: {description}
[if rumored:] - Turn {turn} — {title}: Reportedly: {description}

#### Canon Facts
[key_facts list, max 10 entries]
- {fact}

#### Deceased / Absent
- {name} ({status} — {notes})
```

### Modify `ChatRequest` in `models.py`

```python
class ChatRequest(BaseModel):
    messages: list[StoryMessage]
    scenario: Scenario | None = None
    world_state: WorldStateModel | None = None   # NEW
    stream: bool = False
    enable_thinking: bool = False
```

### Modify `ChatService.buildScenarioPayload()` in `chat.service.ts`

```typescript
world_state: this.worldStateService.state()
  ? this.worldStateToPayload(this.worldStateService.state()!)
  : null
```

### Verification
- System prompt with world state stays under 800 tokens (budget check)
- Dead NPC name does NOT appear in "Active NPCs" section
- Faction block renders `standing_label()` text + number
- `grep "world_state" apps/llama-proxy/routes/generate.py` → no matches (generation endpoints don't need it)

---

## Phase 3 — LLM World State Updates

**Goal:** After each chat turn, extract a structured `WorldStateDelta` from the exchange. Non-blocking — fires after stream completes.

### New endpoint `POST /world-state/update` in `routes/generate.py`

**Request:**
```python
class WorldStateUpdateRequest(BaseModel):
    scenario: Scenario
    world_state: WorldStateModel
    last_exchanges: list[StoryMessage]  # last 3 pairs (6 messages) — NOT just 1
```

**Response:**
```python
class FactionChange(BaseModel):
    faction_id: str
    standing_delta: int = 0      # capped at ±25 per turn by prompt instruction
    notes_append: str = ""

class NpcChange(BaseModel):
    npc_id: str
    new_status: Literal["alive", "dead", "missing", "unknown"] | None = None
    disposition_delta: int = 0   # capped at ±25 per turn by prompt instruction
    new_known_facts: list[str] = []
    notes_append: str = ""

class SceneUpdate(BaseModel):
    location_id: str | None = None
    add_npc_ids: list[str] = []
    remove_npc_ids: list[str] = []
    new_tension: Literal["calm", "tense", "hostile", "combat"] | None = None
    scene_note: str = ""

class WorldStateDelta(BaseModel):
    faction_changes: list[FactionChange] = []
    npc_changes: list[NpcChange] = []
    new_events: list[StoryEventModel] = []
    scene_update: SceneUpdate | None = None
    clock_advance: bool = False    # true when narrative implies significant time passed
    key_facts_append: list[str] = []   # new global canon facts (max 2 per turn)
```

### System prompt for this endpoint (critical — follow exactly)

```
You are the world state tracker for an interactive story.
Analyze the story exchange and extract ONLY what actually changed.

Available NPC IDs (use these exactly):
{for each npc in world_state.npc_states:}
- "{npc.npc_id}": {npc.name}

Available faction IDs (use these exactly):
{for each faction in world_state.factions:}
- "{faction.id}": {faction.name}

Rules:
1. Only mark NPC status as "dead" if the narrative EXPLICITLY states death — not "might be dead", "fled", "disappeared".
2. Disposition changes: only when the narrative shows a clear positive/negative interaction. Cap at ±25 per turn.
3. New events: only for distinct actions, discoveries, or confrontations — not ambient description. Title ≤6 words. Set certainty="witnessed" if the player character was present.
4. Scene update: change location_id if the player moved. Add/remove NPC IDs from present_npc_ids as they enter/leave. Update tension to "hostile" or "combat" only when appropriate.
5. clock_advance: true only when the narrative implies a rest, journey, or time-skip.
6. key_facts_append: only for major permanent facts ("Aldric is the guild master", "The artifact is cursed"). Max 2 per turn.
7. Use ONLY the IDs from the tables above. If an entity has no listed ID, omit it.
8. If NOTHING changed, return all empty arrays/null — do not invent changes.

Output ONLY valid JSON matching the WorldStateDelta schema.
```

### `WorldStateService.applyDelta()` — ID validation

```typescript
applyDelta(delta: WorldStateDelta): void {
  const knownNpcIds = new Set(this.state()!.npcStates.map(n => n.npcId));
  const knownFactionIds = new Set(this.state()!.factions.map(f => f.id));

  // Silently discard changes with unknown IDs (log warning for dev)
  const validNpcChanges = delta.npcChanges.filter(c => {
    const valid = knownNpcIds.has(c.npcId);
    if (!valid) console.warn(`WorldStateDelta: unknown npcId "${c.npcId}" discarded`);
    return valid;
  });
  // ... same for factionChanges
}
```

### Frontend trigger — `ChatService.sendMessage()`

After stream completes, if `worldStateService.state()` is set:
```typescript
// Non-blocking fire-and-forget — narrative already delivered
this.aiAssistService.updateWorldState({
  scenario: this.buildScenarioPayload(),
  world_state: this.worldStateService.toPayload(),
  last_exchanges: this.messages().slice(-6),   // last 3 pairs
}).subscribe(delta => {
  this.worldStateService.applyDelta(delta);
  const contradictions = this.worldStateService.detectContradictions(lastAssistantMessage);
  if (contradictions.length) this.contradictions.set(contradictions);
});
```

**Temperature for this endpoint:** 0.1–0.2 (deterministic extraction, not creative generation).

### Verification
- `/world-state/update` returns valid `WorldStateDelta` JSON for a fixture exchange
- `applyDelta()` discards delta entries with unknown IDs (unit test with mismatched ID)
- Disposition delta > 25 is clamped to 25 in `applyDelta()`
- Delta call fires after stream completes (not during) — verify via network timing in dev tools

---

## Phase 4 — World State UI

**Goal:** Collapsible side panel in `ChatComponent` showing live state + contradiction alerts.

### Layout

Collapsible side panel toggled by icon button in chat header. Keeps chat in view. Tabs:

**Scene tab** (default, shown first):
- Current location name + description
- Present NPCs with disposition bars
- Tension badge (color-coded: green=calm → red=combat)
- World clock display

**Factions tab:**
- List with standing bar (labeled: Allied / Friendly / Neutral / Hostile / Enemy)
- Click to expand: territories, allies/enemies, archetypes, notes
- Inline edit standing + notes

**NPCs tab:**
- Groups: Present (in scene) → Alive → Missing/Unknown → Deceased
- Each: name, disposition bar, location, known facts (collapsible)
- Inline edit status, disposition, notes

**Events tab:**
- Chronological list with certainty badge (Witnessed / Rumored / Deduced)
- Filter by type (combat / faction / discovery / etc.)
- Click to expand

**Contradiction alerts:**
- Non-blocking warning badge in chat header: "⚠ 1 contradiction"
- Expands to list: "Guard Captain Aldric (dead) appeared in narrative"
- User can dismiss or open world state to investigate

### Verification
- Standing bar renders correctly at -100, -50, 0, +50, +100
- NPC status change updates signal + persists
- Panel toggle doesn't break chat auto-scroll

---

## Phase 5 — DM Tools Integration

**Goal:** Bridge isolated DM tab into the living world.

### Changes to `DmComponent`

"Add to World" button on each saved NPC:
```typescript
addNpcToWorld(npc: DmNpc): void {
  const npcState: NpcState = {
    npcId: npc.id,
    name: npc.name,
    status: 'alive',
    disposition: 0,
    relationships: [],
    knownFacts: [],
    notes: npc.personality,
    locationId: undefined,
  };
  this.worldStateService.addNpcState(npcState);
}
```

"Activate Quest" → adds to `worldStateService.state().keyFacts` with quest objectives as facts.

### ScenarioForm — import NPCs from world state

"Import from World" button in NPC section → lists `WorldState.npcStates` → clicking pre-fills NPC form from stored `DmNpc` data.

### Verification
- DM NPC correctly appears in world state NPC list after import
- Quest activation adds objectives to `keyFacts`

---

## Phase 6 — Session Memory (Context Compression)

**Goal:** Compress old messages for long campaigns. Simpler than original plan — manual trigger first, LLM-generated summary as optional enhancement.

### Simple strategy (implement first)

When `ChatService.estimatedTokens() > 3000` (warning threshold):
- "Compress session" button appears in chat
- On click: auto-trim oldest 20 messages from `messages` signal
- Summarize them into a `SessionSummary` with user-written or LLM-generated `keyFacts`
- Store in `WorldState.sessionSummaries`
- Inject last summary into next system prompt as:
  ```
  ### Previous Session (turns {range[0]}–{range[1]})
  {summary}
  Key facts: {keyFacts.join(' | ')}
  ```

### Optional: `POST /summarize` endpoint (Phase 6b)

```python
class SummarizeRequest(BaseModel):
    messages: list[StoryMessage]    # messages to compress
    scenario: Scenario
    world_state: WorldStateModel

class SummarizeResponse(BaseModel):
    summary: str                    # 1-3 paragraph narrative recap
    key_facts: list[str]            # max 10 bullet points
    world_state_delta: WorldStateDelta
```

System prompt extracts narrative summary + key facts + world state changes in one call. Uses JSON output mode.

### Verification
- Session summary stored in `WorldState.sessionSummaries`
- Message array shrinks after compression
- Summary injected in next system prompt request
- Token count drops below warning threshold after compression

---

## Technical Priorities (revised order)

| Priority | Phase | Why |
|---|---|---|
| 1 | Phase 1 — Data model (complete) | All future phases depend on it. Include all fields now. |
| 2 | Phase 2 — System prompt (with prompt rules) | Immediate LLM coherence gain. Low effort, high value. |
| 3 | Phase 4 — World State UI | Need to see/edit state before trusting Phase 3 output |
| 4 | Phase 3 — LLM delta updates | The core feature. Requires UI to verify it works. |
| 5 | Phase 6 — Context compression | Needed for long campaigns. Simple version first. |
| 6 | Phase 5 — DM integration | Additive convenience. Not a coherence feature. |

## What NOT to build

- **Server-side persistence** — localStorage per scenario is sufficient.
- **Real-time multiplayer** — single-user throughout.
- **Rules engine (HP tracking, dice rolls)** — LLM handles mechanics, keep them out of the app.
- **Static NPC dialogue trees** — LLM does branching; trees constrain it.
- **Free-text `session_notes` blob** — structured `keyFacts: string[]` (max 10) is more controllable and token-efficient.

## Key anti-patterns (from expert review)

| Anti-pattern | Why bad | Fix |
|---|---|---|
| Dead NPC in "Active NPCs" section | LLM still references them | Separate "Deceased" block with explicit instruction |
| Raw faction standing number (`-47`) | LLM can't map to behavior | `standing_label()` + number together |
| Full world state in system prompt | Blows context budget | `toCompactPrompt(maxBudget)` always |
| Delta endpoint gets only last message pair | Misses cause-effect chains | Send last 3 pairs (6 messages) |
| No ID reference table in delta prompt | LLM invents IDs, changes silently fail | Inject compact ID-to-name map |
| "Be conservative" delta instruction | Too vague, wildly inconsistent | Explicit rules with ±25 cap and death-only-if-explicit |
