# Graph Report - nx-monorepo-experiment  (2026-05-01)

## Corpus Check
- 108 files · ~34,313 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 482 nodes · 785 edges · 23 communities detected
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 288 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]

## God Nodes (most connected - your core abstractions)
1. `DmComponent` - 50 edges
2. `ScenarioFormComponent` - 26 edges
3. `ChatComponent` - 26 edges
4. `WorldStateService` - 23 edges
5. `SessionZeroComponent` - 19 edges
6. `Scenario` - 18 edges
7. `ChatService` - 14 edges
8. `call_llm()` - 14 edges
9. `_extract_json_object()` - 14 edges
10. `_CamelModel` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ChatResponse` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/chat.py
- `AssistResponse` --calls--> `assist()`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/generate.py
- `update_world_state()` --calls--> `WorldStateDelta`  [INFERRED]
  apps/llama-proxy/routes/world_state.py → apps/llama-proxy/models.py
- `world_tick()` --calls--> `WorldStateDelta`  [INFERRED]
  apps/llama-proxy/routes/world_state.py → apps/llama-proxy/models.py
- `stream_chat()` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/llm.py → apps/llama-proxy/routes/chat.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (12): BondStateService, CombatStateService, dmNpcToNpcState(), dmQuestToQuestEntry(), FactionStateService, JournalComponent, LoadingBusService, NpcStateService (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (53): BaseModel, CombatParticipantPayload, CombatResolution, CombatResolveRequest, CombatStatePayload, resolve_combat_turn(), GenerateFactionSetRequest, GenerateOpeningSceneRequest (+45 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (1): DmComponent

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (6): App, AppErrorService, ChatService, ErrorBoundaryComponent, SessionService, WorldSyncService

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (3): PresetScenarioService, ScenarioApiService, ScenarioFormComponent

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (2): ChatAssistService, ChatComponent

### Community 6 - "Community 6"
Cohesion: 0.21
Nodes (19): assist(), generate_faction_set(), generate_npc(), generate_opening_scene(), generate_oracle(), generate_quest(), generate_scenario(), _extract_json_object() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (2): ScenarioService, SessionZeroComponent

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (2): SettingsComponent, SettingsService

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (2): CombatComponent, CombatService

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (2): StorageService, WorldStateStore

### Community 12 - "Community 12"
Cohesion: 0.39
Nodes (7): build_tone_fragment(), chat(), build_interpersonal_system_prompt(), build_kickoff_prompt(), build_system_prompt(), _build_world_state_block(), standing_label()

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (1): WorldPanelComponent

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (1): MenuComponent

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (1): DmApiService

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (1): ActionPanelComponent

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (1): NpcApiService

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (1): InitiativeTrackerComponent

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (1): CombatLogComponent

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (1): Remove markdown code fences from LLM output.

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (1): Find and return the first complete {...} JSON object in text.     More robust th

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (1): Build a fix-retry message list that gives the model clear instructions.

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (1): Hidden user message to trigger the opening narration when no messages exist.

## Knowledge Gaps
- **7 isolated node(s):** `Accept camelCase keys from the Angular frontend.`, `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.`, `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 2`** (51 nodes): `.set()`, `DmComponent`, `.addEncounter()`, `.addMonster()`, `.addNpcAction()`, `.addNpcClass()`, `.addNpcListItem()`, `.addObjective()`, `.addRewardItem()`, `.deleteNpc()`, `.deleteQuest()`, `.difficultyClass()`, `.generateNpc()`, `.generateQuest()`, `.goBack()`, `.goToSessionZero()`, `.loadNpcs()`, `.loadQuests()`, `.newNpc()`, `.newQuest()`, `.removeEncounter()`, `.removeMonster()`, `.removeNpcAction()`, `.removeNpcClass()`, `.removeNpcListItem()`, `.removeObjective()`, `.removeRewardItem()`, `.saveNpc()`, `.saveQuest()`, `.saveToStorage()`, `.setTab()`, `.statKeys()`, `.statLabel()`, `.updateEncounterDesc()`, `._updateMonster()`, `.updateMonsterCr()`, `.updateMonsterName()`, `.updateNpcActionDesc()`, `.updateNpcActionName()`, `.updateNpcClassLevel()`, `.updateNpcClassName()`, `.updateNpcField()`, `.updateNpcListItem()`, `.updateNpcStat()`, `.updateObjective()`, `.updateQuestField()`, `.updateRewardGold()`, `.updateRewardItem()`, `.updateRewardSilver()`, `dm.component.ts`, `.generateNpcWithAi()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 5`** (28 nodes): `ChatAssistService`, `.callAssist()`, `.rewriteInput()`, `.suggestInput()`, `ChatComponent`, `.aiSuggestOrRewrite()`, `.cancelAction()`, `.dismissContextBanner()`, `.dismissContradictions()`, `.executeChange()`, `.focusInput()`, `.generateOracle()`, `.ngOnDestroy()`, `.onInput()`, `.onKeydown()`, `.renderMarkdown()`, `.requestChange()`, `.requestNew()`, `.requestReset()`, `.requestTrim()`, `.send()`, `.setWorldTab()`, `.toggleInputType()`, `.toggleOracle()`, `.toggleScenarioInfo()`, `.toggleWorldPanel()`, `chat-assist.service.ts`, `chat.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (21 nodes): `session-zero.component.ts`, `scenario.service.ts`, `.start()`, `ScenarioService`, `.load()`, `.setScenario()`, `SessionZeroComponent`, `.factionsForStep3()`, `.generateNpcForFaction()`, `.generatePremise()`, `.goBack()`, `.nextStep()`, `.npcCountForFaction()`, `.npcNamesForFaction()`, `.npcsForFaction()`, `.prevStep()`, `.startAdventure()`, `.stepLabel()`, `.syncOpeningSceneFromFields()`, `.totalNpcCount()`, `.updateFactionField()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (16 nodes): `settings.component.ts`, `settings.service.ts`, `SettingsComponent`, `.goBack()`, `.ngOnInit()`, `.selectBackend()`, `.updateTone()`, `SettingsService`, `.activeBackend()`, `.checkHealth()`, `.constructor()`, `.loadConfig()`, `._patchBackend()`, `.setActiveBackend()`, `.setEnableThinking()`, `.updateTone()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (16 nodes): `.enterCombat()`, `CombatComponent`, `.endCombat()`, `.ngOnInit()`, `.onAction()`, `CombatService`, `.buildScenarioPayload()`, `.derivePlayerCharacterFromScenario()`, `.endCombat()`, `.resolveTurn()`, `.rollInitiative()`, `.startCombat()`, `combat.component.ts`, `combat.service.ts`, `.applyCombatDelta()`, `.setCombatState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (16 nodes): `storage.service.ts`, `world-state.store.ts`, `StorageService`, `.delete()`, `.listByPrefix()`, `.load()`, `.save()`, `upgrade()`, `WorldStateStore`, `.clearState()`, `.constructor()`, `.exportToFile()`, `.importFromFile()`, `.loadForScenario()`, `.migrate()`, `.persistNow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (6 nodes): `world-panel.component.ts`, `WorldPanelComponent`, `.findNpcById()`, `.setTab()`, `.standingColor()`, `.standingLabel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (5 nodes): `menu.component.ts`, `MenuComponent`, `.goToJournal()`, `.goToSettings()`, `.selectMode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (4 nodes): `DmApiService`, `.generateNpc()`, `.generateQuest()`, `dm-api.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (4 nodes): `ActionPanelComponent`, `.emitAction()`, `.submitText()`, `action-panel.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (3 nodes): `npc-api.service.ts`, `NpcApiService`, `.generateNpc()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (3 nodes): `InitiativeTrackerComponent`, `.hpPercent()`, `initiative-tracker.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (3 nodes): `CombatLogComponent`, `.ngAfterViewChecked()`, `combat-log.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `Remove markdown code fences from LLM output.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `Find and return the first complete {...} JSON object in text.     More robust th`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `Build a fix-retry message list that gives the model clear instructions.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `Hidden user message to trigger the opening narration when no messages exist.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Scenario` connect `Community 1` to `Community 7`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `ScenarioFormComponent` connect `Community 4` to `Community 2`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `ToneSettings` connect `Community 1` to `Community 8`, `Community 3`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `Accept camelCase keys from the Angular frontend.`, `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._