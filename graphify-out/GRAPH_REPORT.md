# Graph Report - nx-monorepo-experiment  (2026-04-26)

## Corpus Check
- 42 files · ~17,589 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 257 nodes · 329 edges · 16 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]

## God Nodes (most connected - your core abstractions)
1. `DmComponent` - 47 edges
2. `ScenarioFormComponent` - 26 edges
3. `ChatComponent` - 24 edges
4. `WorldStateService` - 16 edges
5. `ChatService` - 13 edges
6. `call_llm()` - 8 edges
7. `_extract_json_object()` - 8 edges
8. `AiAssistService` - 8 edges
9. `chat()` - 7 edges
10. `SettingsService` - 7 edges

## Surprising Connections (you probably didn't know these)
- `ChatResponse` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/chat.py
- `AssistResponse` --calls--> `assist()`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/generate.py
- `WorldStateDelta` --calls--> `update_world_state()`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/generate.py
- `stream_chat()` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/llm.py → apps/llama-proxy/routes/chat.py
- `call_llm()` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/llm.py → apps/llama-proxy/routes/chat.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (1): DmComponent

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (3): ErrorBoundaryComponent, PresetScenarioService, ScenarioFormComponent

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (2): AiAssistService, ChatComponent

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (26): BaseModel, AssistRequest, AssistResponse, BackendPatchRequest, ChatRequest, ChatResponse, CurrentSceneModel, FactionChange (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (2): standingLabel(), WorldStateService

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (14): assist(), generate_npc(), generate_quest(), generate_scenario(), update_world_state(), _extract_json_object(), _fix_retry_messages(), _parse_with_repair() (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (1): ChatService

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (2): SettingsComponent, SettingsService

### Community 8 - "Community 8"
Cohesion: 0.43
Nodes (6): chat(), build_interpersonal_system_prompt(), build_kickoff_prompt(), build_system_prompt(), _build_world_state_block(), standing_label()

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (1): ScenarioService

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (1): MenuComponent

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (1): App

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): Remove markdown code fences from LLM output.

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (1): Find and return the first complete {...} JSON object in text.     More robust th

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (1): Build a fix-retry message list that gives the model clear instructions.

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): Hidden user message to trigger the opening narration when no messages exist.

## Knowledge Gaps
- **7 isolated node(s):** `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.`, `App`, `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 0`** (47 nodes): `dm.component.ts`, `DmComponent`, `.addEncounter()`, `.addMonster()`, `.addNpcAction()`, `.addNpcClass()`, `.addNpcListItem()`, `.addObjective()`, `.addRewardItem()`, `.deleteNpc()`, `.deleteQuest()`, `.difficultyClass()`, `.generateQuest()`, `.goBack()`, `.loadNpcs()`, `.loadQuests()`, `.newNpc()`, `.newQuest()`, `.removeEncounter()`, `.removeMonster()`, `.removeNpcAction()`, `.removeNpcClass()`, `.removeNpcListItem()`, `.removeObjective()`, `.removeRewardItem()`, `.saveNpc()`, `.saveQuest()`, `.saveToStorage()`, `.setTab()`, `.statKeys()`, `.statLabel()`, `.updateEncounterDesc()`, `._updateMonster()`, `.updateMonsterCr()`, `.updateMonsterName()`, `.updateNpcActionDesc()`, `.updateNpcActionName()`, `.updateNpcClassLevel()`, `.updateNpcClassName()`, `.updateNpcField()`, `.updateNpcListItem()`, `.updateNpcStat()`, `.updateObjective()`, `.updateQuestField()`, `.updateRewardGold()`, `.updateRewardItem()`, `.updateRewardSilver()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 2`** (31 nodes): `AiAssistService`, `.callAssist()`, `.generateNpc()`, `.generateQuest()`, `.rewriteInput()`, `.suggestInput()`, `.updateWorldState()`, `chat.component.ts`, `ai-assist.service.ts`, `ChatComponent`, `.aiSuggestOrRewrite()`, `.cancelAction()`, `.dismissContradictions()`, `.executeChange()`, `.findNpcById()`, `.focusInput()`, `.onInput()`, `.onKeydown()`, `.renderMarkdown()`, `.requestChange()`, `.requestNew()`, `.requestReset()`, `.requestTrim()`, `.send()`, `.setWorldTab()`, `.standingColor()`, `.standingLabel()`, `.toggleInputType()`, `.toggleScenarioInfo()`, `.toggleWorldPanel()`, `.triggerWorldStateUpdate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (20 nodes): `world-state.service.ts`, `.ngOnInit()`, `.loadPersistedMessages()`, `standingLabel()`, `WorldStateService`, `.addEvent()`, `.addFaction()`, `.addNpcState()`, `.applyDelta()`, `.clearState()`, `.constructor()`, `.detectContradictions()`, `.initForScenario()`, `.loadForScenario()`, `.migrate()`, `.persistNow()`, `.toCompactPrompt()`, `.updateFaction()`, `.updateNpcState()`, `.updateScene()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (14 nodes): `chat.service.ts`, `.confirmAction()`, `ChatService`, `.appendToLastMessage()`, `.buildScenarioPayload()`, `.cancelStream()`, `.initializeStory()`, `.persistMessages()`, `.regenerateLastResponse()`, `.resetMessages()`, `.sendMessage()`, `.streamRequest()`, `.streamWithRetry()`, `.trimContext()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (13 nodes): `settings.component.ts`, `settings.service.ts`, `SettingsComponent`, `.goBack()`, `.ngOnInit()`, `.selectBackend()`, `SettingsService`, `.activeBackend()`, `.checkHealth()`, `.loadConfig()`, `._patchBackend()`, `.setActiveBackend()`, `.setEnableThinking()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (6 nodes): `scenario.service.ts`, `.start()`, `ScenarioService`, `.clearScenario()`, `.load()`, `.setScenario()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (4 nodes): `menu.component.ts`, `MenuComponent`, `.goToSettings()`, `.selectMode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `App`, `app.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `Remove markdown code fences from LLM output.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `Find and return the first complete {...} JSON object in text.     More robust th`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `Build a fix-retry message list that gives the model clear instructions.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `Hidden user message to trigger the opening narration when no messages exist.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ScenarioFormComponent` connect `Community 1` to `Community 9`?**
  _High betweenness centrality (0.231) - this node is a cross-community bridge._
- **Why does `DmComponent` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Why does `ChatComponent` connect `Community 2` to `Community 4`, `Community 6`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **What connects `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.`, `App` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._