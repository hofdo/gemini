# Storage Analysis: World State Persistence

Companion to `adventure-world-state-roadmap.md`.

---

## Current Storage Inventory

| Key | Type | Typical size | Write cadence |
|---|---|---|---|
| `llama_chat_messages` | `{ title, messages[] }` | ~8 KB | After every message |
| `llama-scenario` | `Scenario` | ~2 KB | On scenario save only |
| `llm_active_backend_id` | string | ~20 B | On backend switch |
| `llm_enable_thinking` | `'true'\|'false'` | ~5 B | On toggle |
| `dm_saved_quests` | `Quest[]` | ~8 KB (10 quests) | On save/delete |
| `dm_saved_npcs` | `DmNpc[]` | ~15 KB (10 NPCs) | On save/delete |
| **Total** | | **~33 KB** | |

All storage is synchronous localStorage. No IndexedDB, no sessionStorage.

---

## Projected WorldState Sizes

### Per-campaign estimate

| Component | Moderate campaign | Long campaign |
|---|---|---|
| `currentScene` + `worldClock` | ~0.1 KB | ~0.1 KB |
| `factions` (20 / 50) | ~8 KB | ~20 KB |
| `npcStates` + relationships (30 / 100) | ~15 KB | ~50 KB |
| `storyEvents` (100 / 500) | ~20 KB | ~100 KB |
| `keyFacts` (capped 10) | ~0.5 KB | ~0.5 KB |
| `sessionSummaries` (5 / 20) | ~3.5 KB | ~14 KB |
| **Total per campaign** | **~47 KB** | **~185 KB** |

### localStorage budget reality

- 5 active campaigns (long): ~925 KB
- Existing app data: ~33 KB
- **Total projection: ~1 MB** — safely within 5 MB limit for realistic use

`StoryEvents` is the only unbounded array. At 5 events/session × 50 sessions = 250 events = ~50 KB. Must be capped (see below).

---

## Storage Decision

**localStorage for everything — with structural guardrails.**

No IndexedDB needed unless:
- WorldState exceeds ~1 MB per campaign (requires 500+ events or 200+ NPCs)
- User needs multiple save slots for the same scenario
- Data export/import becomes a requirement

These are Phase 6+ concerns. Plan for IndexedDB migration in Phase 6 but do not build it now.

---

## Storage Keys

One key per campaign, keyed by scenario ID (not title — titles can change):

```
llama-world-state-{scenarioId}    WorldState JSON
llama-chat-{scenarioId}           Chat messages (replace current llama_chat_messages)
llama-scenario                    Active Scenario (existing — keep as-is)
llm_active_backend_id             string (existing — keep as-is)
llm_enable_thinking               string (existing — keep as-is)
dm_saved_quests                   Quest[] (existing — keep as-is)
dm_saved_npcs                     DmNpc[] (existing — keep as-is)
```

**Why `scenarioId` not `scenarioTitle`:** titles are user-editable and contain special characters. The current `llama_chat_messages` uses title for matching (chat.service.ts:41) — this is already fragile. `WorldState.id` (UUID generated at init) is the stable key.

---

## Critical Guardrail: StoryEvent Cap

`StoryEvents` is unbounded. Without a cap it will dominate the key's size.

### Strategy: hot / archived split

```typescript
export interface WorldState {
  // ...
  storyEvents: StoryEvent[];          // hot: last 50 witnessed events
  archivedEventCount: number;         // count of events before the hot window
  archivedEventSummary: string;       // LLM-compressed summary of archived events
}
```

**Rules in `WorldStateService.addEvent()`:**
- Append to `storyEvents`
- If `storyEvents.length > 50`: trim oldest 10, increment `archivedEventCount += 10`
- `archivedEventSummary` updated manually or via Phase 6 `POST /summarize`

**Why 50:** at ~200 bytes/event that's ~10 KB — a small fixed budget. The last 3 events are injected into the system prompt; older events are available for the UI timeline but not the LLM.

---

## Schema Versioning

No stored payload in the current codebase has a version field. This works until a field is renamed or removed. The DM component handles it via silent migration on load (dm.component.ts:397–427) — the correct approach, but ad-hoc.

### Add version field to `WorldState`

```typescript
export interface WorldState {
  _schemaVersion: number;   // increment when breaking changes occur
  // ...
}
```

### Migration runner in `WorldStateService.load()`

```typescript
private migrate(raw: Partial<WorldState>): WorldState {
  const version = raw._schemaVersion ?? 0;

  // v0 → v1: add worldClock
  if (version < 1) {
    raw.worldClock = { dayNumber: 1, timeOfDay: 'morning', season: 'spring', turnsPerDay: 8 };
  }
  // v1 → v2: add archivedEventCount
  if (version < 2) {
    raw.archivedEventCount = 0;
    raw.archivedEventSummary = '';
  }
  // ... future migrations

  return { ...raw, _schemaVersion: CURRENT_SCHEMA_VERSION } as WorldState;
}
```

**Current schema version constant:** `CURRENT_SCHEMA_VERSION = 1` (start at 1 with Phase 1 implementation).

---

## Write Pattern: `effect()` vs explicit calls

Current codebase pattern (explicit):
```typescript
// Every mutation method must manually call localStorage.setItem
setScenario(s: Scenario): void {
  this.activeScenario.set(s);
  localStorage.setItem(KEY, JSON.stringify(s));  // must not forget this
}
```

**Problem:** `WorldStateService` will have 10+ mutation methods. Each must remember to call `persist()` or state silently isn't saved.

### Recommended: `effect()` as the single write path

```typescript
@Injectable({ providedIn: 'root' })
export class WorldStateService {
  readonly state = signal<WorldState | null>(this.load());

  constructor() {
    // Single write path — fires after every signal mutation automatically
    effect(() => {
      const current = this.state();
      if (current) {
        try {
          localStorage.setItem(
            `llama-world-state-${current.id}`,
            JSON.stringify(current)
          );
        } catch {
          // QuotaExceededError — silent, in-memory state still valid
        }
      }
    });
  }

  // Mutation methods just call .update() — no manual persist needed
  addEvent(event: Omit<StoryEvent, 'id' | 'turn'>): void {
    this.state.update(s => s ? {
      ...s,
      storyEvents: [...s.storyEvents, { ...event, id: crypto.randomUUID(), turn: s.turnCount }],
      turnCount: s.turnCount + 1,
      lastUpdated: new Date().toISOString(),
    } : s);
    // No localStorage.setItem call needed — effect handles it
  }
}
```

**Caveat:** `effect()` fires asynchronously (microtask). There is a theoretical race on immediate page close after a mutation. Mitigation: also call `localStorage.setItem` synchronously inside `applyDelta()` (the highest-frequency write path after chat turns) and rely on `effect()` for all other mutations.

---

## Write Frequency Analysis

| Operation | Frequency | Write size | Impact |
|---|---|---|---|
| `applyDelta()` after chat turn | Every message | ~50 KB full state | Must be fast — consider debouncing |
| `addEvent()` | Every notable turn | ~50 KB full state | Bundled into `applyDelta()` |
| `updateFaction()` / `updateNpcState()` | Rare (user edits) | ~50 KB full state | Acceptable |
| `initForScenario()` | Once per session | ~1 KB initial | Negligible |

### Write debounce for chat-turn writes

At ~200 bytes average per message × 50 messages = ~10 KB for chat history. WorldState at ~50 KB. Writing 60 KB synchronously after every message is safe on desktop but adds ~1–5 ms per turn.

Optimization: debounce the `effect()` write with 1 second delay for all paths except `applyDelta()`, which writes synchronously.

```typescript
private readonly DEBOUNCE_MS = 1000;
private debounceTimer: ReturnType<typeof setTimeout> | null = null;

private persistDebounced(state: WorldState): void {
  if (this.debounceTimer) clearTimeout(this.debounceTimer);
  this.debounceTimer = setTimeout(() => this.persistNow(state), this.DEBOUNCE_MS);
}

// applyDelta() calls persistNow() directly — no debounce
applyDelta(delta: WorldStateDelta): void {
  this.state.update(s => /* ... apply delta ... */);
  this.persistNow(this.state()!);
}
```

---

## Chat Message Storage — Key Migration

Current: `llama_chat_messages` stores `{ title: string; messages: ChatMessage[] }` — uses scenario title for matching (chat.service.ts:41). Fragile.

**Migration in Phase 1:** change to `llama-chat-{scenarioId}`. When `WorldState` is initialized for a scenario, `ChatService` gets the `scenarioId` and uses it as the key. Backward compat: on load, if `llama-chat-{id}` is missing, fall back to reading `llama_chat_messages` and migrating it.

---

## Future: IndexedDB Migration Path (Phase 6+)

If storage needs exceed localStorage limits, the migration is straightforward because `WorldStateService` already encapsulates all reads/writes:

```typescript
// Phase 1-5: localStorage
private async loadFromStorage(id: string): Promise<WorldState | null> {
  const raw = localStorage.getItem(`llama-world-state-${id}`);
  return raw ? this.migrate(JSON.parse(raw)) : null;
}

// Phase 6: swap to Dexie — only this method changes
private async loadFromStorage(id: string): Promise<WorldState | null> {
  return (await db.worlds.get(id))?.data ?? null;
}
```

**Dexie schema for future reference:**
```typescript
import Dexie, { type EntityTable } from 'dexie';

interface WorldRecord { id: string; data: WorldState; updatedAt: Date; }
interface ChatRecord  { scenarioId: string; messages: ChatMessage[]; }

const db = new Dexie('llama-rpg') as Dexie & {
  worlds: EntityTable<WorldRecord, 'id'>;
  chats:  EntityTable<ChatRecord, 'scenarioId'>;
};

db.version(1).stores({
  worlds: 'id, updatedAt',
  chats:  'scenarioId',
});
```

---

## Summary: Storage Rules for Phase 1

| Rule | Rationale |
|---|---|
| localStorage for all state — no IndexedDB yet | ~1 MB projected max; well within 5 MB budget |
| Key: `llama-world-state-{WorldState.id}` | Stable UUID, not editable title |
| `_schemaVersion` field in `WorldState` | Enables safe migrations |
| Migration runner in `WorldStateService.load()` | Consistent with existing DM component pattern |
| `effect()` as single write path; `applyDelta()` also writes synchronously | Prevents missed writes; avoids main-thread jank on high-frequency writes |
| `storyEvents` capped at 50, older events archived as summary | Prevents unbounded key growth |
| `keyFacts` capped at 10 entries | Token budget + storage discipline |
| Migrate `llama_chat_messages` → `llama-chat-{scenarioId}` | Fixes title-matching fragility |
