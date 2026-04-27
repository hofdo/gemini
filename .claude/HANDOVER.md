# Session Handover — Living Story Engine

## What this project is

Interactive RPG/storytelling platform. Three-tier:
```
llama-chat (Angular 21, :4200)
    ↓ dev-proxy: /chat /assist /generate-* /config /health /world-state/*
llama-proxy (FastAPI, :8000)
    ↓ httpx streaming
llm (llama.cpp, :8080)
```

Two LLM backends: `gemma4-obliterated` and `gemma4-uncensored`.
`npm run dev` starts everything.

---

## What was built this session

Full 3-phase "Living Story Engine" roadmap designed and implemented.
Plan: `.claude/plans/living-world-roadmap.md`

### Phase 1 — Foundation Hardening (commit `03e133c`)

- `ClockAdvance { turns: number }` replaces `boolean` in `WorldStateDelta.clockAdvance` → enables time-of-day progression within a day
- `WorldState._schemaVersion` bumped to 2; `migrate()` handles v1→v2
- `loadForScenario()` replaced localStorage scan loop with indexed lookup via `llama-world-index` key
- `SessionService` extracted — owns turn-complete lifecycle; `ChatComponent` no longer calls world-state update directly
- `WorldSyncService` extracted from `AiAssistService` — owns `/world-state/update` calls + proper-noun pre-filter (skips ~30% unnecessary LLM calls when message contains no known NPC/faction/location names)
- `WorldPanelComponent` extracted from `chat.component.html` — reusable standalone component
- `/world-state/update` moved from `generate.py` → `routes/world_state.py`
- `context_window: 8192` added to backend config; `ChatService.contextWarning` now uses `settingsService.contextWindow()` signal at 50% threshold

### Phase 2 — Persistence + DM Integration (commit `c055aa5`)

- `StorageService` — IndexedDB via `idb` package; `WorldStateService` fully migrated off localStorage
- `WorldState` schema v3: added `QuestEntry`, `PlayerCharacter`, `StoryBeat`, `choiceChronicle[]`, `questLog[]`, `playerCharacter`
- `WorldStateDelta`: added `questUpdates[]`, `playerUpdate`, `storyBeatUpdate` — all applied in `applyDelta()`
- `WorldStateService`: `addQuest()`, `updateQuestObjective()`, `addSessionSummary()`, `exportToFile()`, `importFromFile()`
- `dm-npc-adapter.ts` — bridges `DmNpc → NpcState` and `Quest → QuestEntry`
- `DmComponent`: "Add to World" / "Add to Quest Log" buttons (visible only when active scenario exists)
- `JournalComponent` at `/journal` — 4 tabs: Quests, Events, Session Summaries, Character
- `SessionService.maybeSummarize()` — auto-generates session summary every 20 turns via `POST /world-state/summary`
- Python: `QuestEntry`, `PlayerCharacterModel`, `QuestUpdate`, `PlayerUpdate` in `models.py`; `WorldStateDelta` mirrored

### Phase 3 — Living World + Narrative Mechanics (commit `a968861`)

- **Heartbeat (World Tick)**: `POST /world-state/tick` fires when player uses `direct` input type
  - NPC rumors: NPCs with `|disposition| >= 40` may act off-screen → stored as `certainty: 'rumored'` events
  - Faction drift: passive ±2 drift toward neutral each tick
  - Ambient injection: one atmosphere sentence queued; displayed in chat UI for 8s
  - `WorldStateDelta`: `ambientInject`, `npcRumors[]`, `factionDrift[]` added
  - `WorldStateService`: `consumeAmbient()`, `setStoryBeat()`
- **Story Beat Detection**: client-side; detects `inciting_incident / rising_tension / dark_moment / climax_pending / resolution` from WorldState; injected as `STORY_BEAT_HINTS` in LLM system prompt via `chat.py`
- **Tone Controls**: 3 sliders in SettingsComponent (Pacing: cinematic/deliberate, Register: gritty/balanced/mythic, Boundary: fade/standard/unfiltered); persisted to localStorage; sent in `ChatRequest.tone_settings`; `TONE_FRAGMENTS` injected in system prompt
- **Bond Mode Engine**: `BondState` (tier 0–5, emotional temperature, memoryAnchors, milestones, companionMood) initialized for `interpersonal` scenarios; `BondUpdate` applied in `applyDelta()`; tier + temperature injected in interpersonal system prompt
- `InputType` extended: `'dialogue' | 'action' | 'direct' | 'remember'`
- Enhanced contradiction detection: location heuristic (NPC appears near wrong location in narrative)

---

## Current state

### Commits ahead of origin/main
```
a968861  feat(phase-3): living world — heartbeat, story beats, tone controls, bond mode engine
c055aa5  feat(phase-2): persistence, quest log, DM integration, journal, session summaries
03e133c  feat(phase-1): foundation hardening — SessionService, WorldSync, WorldPanel, ClockAdvance
```

### Tests
`npx nx test llama-chat` → 9/9 pass
`npx nx run-many -t lint` → all 3 projects clean

---

## What comes next

Phases 4–6 are designed in `.claude/plans/living-world-roadmap.md`.

### Phase 4 — Error Handling + Context Management (2–3 days)

- `AppError` union type: `llm_unreachable | parse_failure | quota_exceeded | abort`
- Wire existing `ErrorBoundaryComponent` into all lazy-loaded routes
- `LoadingBusService`: replace scattered `loading` signals with keyed bus (`chatLoading`, `worldUpdateLoading`, `assistLoading`, `anyLoading`)
- Tiered context management:
  - Auto-archive at 50% context limit (fold oldest 25% of messages into latest session summary)
  - Warning banner at 75% with 3 actions: Trim / Export & Reset / Continue anyway
  - `systemPromptTokenEstimate` signal in `ChatService` from first response `usage.prompt_tokens`
- Improve `trimContext()`: show preview count, adjustable `keepLast` slider

### Phase 5 — Combat Mode (5–7 days)

- `CombatState` in `WorldState`: initiative order, HP tracking, round log
- `CombatDelta` in `WorldStateDelta`: start/next_turn/end actions, HP changes
- `CombatService`: `startCombat()`, `resolveTurn()`, `endCombat()`
- `POST /combat/resolve-turn` in `routes/combat.py` — temperature 0.1, JSON mode; `CombatPromptBuilder`
- `CombatComponent` at `/combat`: `InitiativeTrackerComponent`, `CombatLogComponent`, `ActionPanelComponent`
- Auto-transition: when `scene.tension === 'combat'`, prompt user to switch mode
- Client-side dice (Math.random + stat modifiers); LLM only for narrative description

### Phase 6 — DM Campaign Forge (3–5 days)

- Session Zero wizard at `/dm/session-zero`: generate premise → factions → NPCs → opening scene → export JSON
- In-session Oracle overlay in ChatComponent: quick NPC name, location, quest hook generation
- Preset scenario library expansion (pre-populated NPCs + factions + opening quest)

---

## Key files

| Path | What it is |
|---|---|
| `apps/llama-chat/src/app/world-state/world-state.model.ts` | All TS types (v3 schema) |
| `apps/llama-chat/src/app/world-state/world-state.service.ts` | State service + IndexedDB persistence |
| `apps/llama-chat/src/app/shared/storage.service.ts` | IndexedDB wrapper via `idb` |
| `apps/llama-chat/src/app/session/session.service.ts` | Turn lifecycle, tick, summarize, beat detection |
| `apps/llama-chat/src/app/shared/world-sync.service.ts` | LLM world-state calls, proper-noun filter |
| `apps/llama-chat/src/app/shared/settings.service.ts` | Backends, contextWindow, toneSettings signals |
| `apps/llama-chat/src/app/world-state/world-panel/world-panel.component.ts` | Extracted world panel |
| `apps/llama-chat/src/app/journal/journal.component.ts` | Journal (/journal route) |
| `apps/llama-chat/src/app/dm/dm-npc-adapter.ts` | DmNpc→NpcState bridge |
| `apps/llama-proxy/models.py` | All Pydantic models (keep in sync with TS model) |
| `apps/llama-proxy/routes/world_state.py` | /world-state/update, /summary, /tick |
| `apps/llama-proxy/routes/chat.py` | /chat, story beat hints, tone fragments, bond context |
| `apps/llama-proxy/routes/generate.py` | /generate-scenario, /generate-npc, /generate-quest |
| `.claude/plans/living-world-roadmap.md` | Full 6-phase roadmap with specs |

---

## Gotchas / invariants

- **TS + Python models must stay in sync** — `world-state.model.ts` ↔ `models.py`. Schema v3. If you add a field to `WorldState` or `WorldStateDelta`, add it to both.
- **Never use localStorage directly** — go through `WorldStateService` (which uses `StorageService` → IndexedDB). Exception: `ToneSettings` and small config items in `SettingsService` still use localStorage directly (acceptable for small config).
- **All Angular components are standalone** — no NgModules. Signals via `signal()`, `computed()`, `effect()`. Injection via `inject()` (not constructor params).
- **World-state update call is fire-and-forget** — `SessionService.onTurnComplete()` does not block the UI. If it fails, `console.warn` only.
- **Proper-noun pre-filter in WorldSyncService** — if the last assistant message contains no known NPC/faction/location names, `/world-state/update` is NOT called. Empty world states (no NPCs/factions/locations yet) will never trigger an update.
- **`fireTick()` only fires on `inputType === 'direct'`** — not on every message.
- **`maybeSummarize()` fires every 20 turns** — requires at least 10 messages to have content.
- **`_schemaVersion` in service** — `CURRENT_SCHEMA_VERSION = 3`. `migrate()` must handle v0→v1→v2→v3 upgrade path.
- **`llama-proxy` virtualenv** — `apps/llama-proxy/.venv`. Run `npx nx run llama-proxy:setup` first time or after new dependencies.
- **`idb` package** — installed at v8.0.3. Used only in `StorageService`.
- **Bond mode** — `BondState` only initialized when `scenario.scenarioType === 'interpersonal'`. For adventure scenarios it is `null`.
- **`'remember'` input type** — added to model and backend but no UI toggle yet in `ChatComponent.toggleInputType()`. Wire it when Bond mode UI is built.