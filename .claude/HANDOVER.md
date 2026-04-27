# Session Handover — Living Story Engine

## What this project is

Interactive RPG/storytelling platform. Three-tier:
```
llama-chat (Angular 21, :4200)
    ↓ dev-proxy: /chat /assist /generate-* /config /health /world-state/* /combat/*
llama-proxy (FastAPI, :8000)
    ↓ httpx streaming
llm (llama.cpp, :8080)
```

Two LLM backends: `gemma4-obliterated` and `gemma4-uncensored`.
`npm run dev` starts everything.

---

## Roadmap status: ALL 6 PHASES COMPLETE

Plan: `.claude/plans/living-world-roadmap.md`

### Phase 1 — Foundation Hardening (commit `03e133c`)

- `ClockAdvance { turns: number }` replaces `boolean` in `WorldStateDelta.clockAdvance`
- `WorldState._schemaVersion` bumped to 2; `migrate()` handles v1→v2
- `loadForScenario()` uses indexed lookup via `llama-world-index` key
- `SessionService` extracted — owns turn-complete lifecycle
- `WorldSyncService` extracted from `AiAssistService` — proper-noun pre-filter (~30% fewer LLM calls)
- `WorldPanelComponent` extracted from chat template
- `/world-state/update` moved to `routes/world_state.py`
- `context_window: 8192` in backend config; `ChatService.contextWarning` at 50% threshold

### Phase 2 — Persistence + DM Integration (commit `c055aa5`)

- `StorageService` — IndexedDB via `idb`; `WorldStateService` fully off localStorage
- `WorldState` schema v3: `QuestEntry`, `PlayerCharacter`, `StoryBeat`, `choiceChronicle[]`, `questLog[]`
- `WorldStateDelta`: `questUpdates[]`, `playerUpdate`, `storyBeatUpdate`
- `WorldStateService`: `addQuest()`, `updateQuestObjective()`, `addSessionSummary()`, `exportToFile()`, `importFromFile()`
- `dm-npc-adapter.ts` — bridges `DmNpc → NpcState` and `Quest → QuestEntry`
- `DmComponent`: "Add to World" / "Add to Quest Log" buttons
- `JournalComponent` at `/journal` — 4 tabs: Quests, Events, Session Summaries, Character
- `SessionService.maybeSummarize()` — auto-generates session summary every 20 turns
- Python: `QuestEntry`, `PlayerCharacterModel`, `QuestUpdate`, `PlayerUpdate` in `models.py`

### Phase 3 — Living World + Narrative Mechanics (commit `a968861`)

- **Heartbeat**: `POST /world-state/tick` fires on `direct` input — NPC rumors, faction drift, ambient injection
- **Story Beat Detection**: client-side; `inciting_incident / rising_tension / dark_moment / climax_pending / resolution`
- **Tone Controls**: 3 sliders (Pacing/Register/Boundary); persisted localStorage; sent in `ChatRequest.tone_settings`
- **Bond Mode Engine**: `BondState` (tier 0–5, emotional temperature, memoryAnchors, milestones) for `interpersonal` scenarios
- `InputType` extended: `'dialogue' | 'action' | 'direct' | 'remember'`

### Phase 4 — Error Handling + Context Management (commit `0378b2b`)

- `AppError` union type: `llm_unreachable | parse_failure | quota_exceeded | abort`
- `ErrorBoundaryComponent` upgraded with type-specific recovery UI
- `LoadingBusService`: keyed signal bus (`chat`, `worldUpdate`, `assist`, `anyLoading`)
- `ChatService`: stream failures set typed `AppError`; `stream_options: { include_usage: true }`; `autoArchiveIfNeeded()`
- Context banner: 3 actions (Trim / Export & Reset / Continue); `keepLast` slider
- Contradiction detection: location heuristic (NPC appears near wrong location)

### Phase 5 — Combat Mode (commit `f77375f`)

- `CombatState`, `CombatParticipant`, `CombatDelta` — TS + Python models
- `combatState: CombatState | null` added to `WorldState`; `combatDelta` to `WorldStateDelta`
- `WorldStateService.setCombatState()` + `applyCombatDelta()`
- `CombatService`: `startCombat()`, `resolveTurn()` (client d20), `endCombat()` — computed signals
- `POST /combat/resolve-turn` in `routes/combat.py` — temp 0.1, JSON mode, 30s
- `CombatComponent` at `/combat` — `InitiativeTrackerComponent`, `CombatLogComponent`, `ActionPanelComponent`
- Auto-transition in `ChatComponent` when `scene.tension === 'combat'`

### Phase 6 — DM Campaign Forge (commit `a07f592`)

- `POST /generate-faction-set` — 3 factions with conflicting goals
- `POST /generate-opening-scene` — scene title, description, opening line, tension
- `POST /generate-oracle` — fast (15s) NPC name / location / quest hook generation
- `SessionZeroComponent` at `/dm/session-zero` — 5-step wizard: premise → factions → NPCs → opening scene → export/start
- Oracle overlay in `ChatComponent` — Ctrl+Shift+O toggle, 3 quick-gen actions, 10-result history
- 3 rich preset scenarios:
  - `adventure/grimdark-frontier.json` — "The Last Stockade" (survival, 3 deeply plotted NPCs)
  - `adventure/heist-city.json` — "The Vault of Forgotten Names" (urban heist thriller)
  - `interpersonal/the-long-absence.json` — "Five Years, Seven Hours" (reunion drama)
  - `index.json` updated with all 4 presets

---

## Current state

### Commits (all pushed to origin/main)
```
a07f592  feat(phase-6): DM Campaign Forge — Session Zero wizard, Oracle mode, 3 rich presets
f77375f  feat(phase-5): combat mode — CombatState, CombatService, /combat route, resolve-turn endpoint
0378b2b  feat(phase-4): error handling, loading bus, tiered context management
a968861  feat(phase-3): living world — heartbeat, story beats, tone controls, bond mode engine
c055aa5  feat(phase-2): persistence, quest log, DM integration, journal, session summaries
03e133c  feat(phase-1): foundation hardening — SessionService, WorldSync, WorldPanel, ClockAdvance
```

### Tests / lint
`npx nx test llama-chat` → 9/9 pass
`npx nx run-many -t lint` → all 3 projects clean

---

## Key files

| Path | What it is |
|---|---|
| `apps/llama-chat/src/app/world-state/world-state.model.ts` | All TS types (v3 schema + CombatState) |
| `apps/llama-chat/src/app/world-state/world-state.service.ts` | State service + IndexedDB persistence |
| `apps/llama-chat/src/app/shared/storage.service.ts` | IndexedDB wrapper via `idb` |
| `apps/llama-chat/src/app/session/session.service.ts` | Turn lifecycle, tick, summarize, beat detection |
| `apps/llama-chat/src/app/shared/world-sync.service.ts` | LLM world-state calls, proper-noun filter |
| `apps/llama-chat/src/app/shared/loading-bus.service.ts` | Keyed loading signal bus |
| `apps/llama-chat/src/app/shared/app-error.service.ts` | AppError union type + global error signal |
| `apps/llama-chat/src/app/shared/settings.service.ts` | Backends, contextWindow, toneSettings signals |
| `apps/llama-chat/src/app/combat/combat.service.ts` | CombatService — startCombat/resolveTurn/endCombat |
| `apps/llama-chat/src/app/combat/combat.component.ts` | CombatComponent at /combat |
| `apps/llama-chat/src/app/dm/session-zero/session-zero.component.ts` | Session Zero wizard at /dm/session-zero |
| `apps/llama-chat/src/app/journal/journal.component.ts` | Journal at /journal |
| `apps/llama-proxy/models.py` | All Pydantic models (keep in sync with TS model) |
| `apps/llama-proxy/routes/world_state.py` | /world-state/update, /summary, /tick |
| `apps/llama-proxy/routes/combat.py` | /combat/resolve-turn |
| `apps/llama-proxy/routes/chat.py` | /chat, story beat hints, tone fragments, bond context |
| `apps/llama-proxy/routes/generate.py` | /generate-scenario, /generate-npc, /generate-quest, /generate-faction-set, /generate-opening-scene, /generate-oracle |
| `apps/llama-chat/public/scenarios/` | Preset scenarios (index.json + 4 presets) |
| `.claude/plans/living-world-roadmap.md` | Full 6-phase roadmap |

---

## Invariants

- **TS + Python models must stay in sync** — `world-state.model.ts` ↔ `models.py`. Schema v3. Add fields to both.
- **Never use localStorage directly** — go through `WorldStateService` → `StorageService` → IndexedDB. Exception: `ToneSettings` in `SettingsService` (acceptable for small config).
- **All Angular components are standalone** — no NgModules. Signals via `signal()`, `computed()`, `effect()`. Injection via `inject()`.
- **World-state update is fire-and-forget** — `SessionService.onTurnComplete()` does not block UI. Failure = `console.warn` only.
- **Proper-noun pre-filter** — if last assistant message has no known NPC/faction/location names, `/world-state/update` not called.
- **`fireTick()` only on `inputType === 'direct'`**
- **`maybeSummarize()` every 20 turns** — requires ≥10 messages
- **`CURRENT_SCHEMA_VERSION = 3`** — `migrate()` handles v0→v1→v2→v3
- **`idb` package v8.0.3** — used only in `StorageService`
- **Bond mode** — `BondState` only initialized for `scenario.scenarioType === 'interpersonal'`
- **Combat** — `CombatService.startCombat()` sets state + navigates to `/combat`; `endCombat()` navigates back to `/chat`
- **Oracle** — `POST /generate-oracle` never throws; always returns `{ result, detail }`

---

## What comes next (post-roadmap ideas)

- Wire `'remember'` input type toggle in `ChatComponent` (added to model but no UI yet)
- Fix pre-existing `NgClass` unused import warning in `world-panel.component.ts`
- E2E test coverage for Phase 5–6 features
- Mobile-responsive layout pass