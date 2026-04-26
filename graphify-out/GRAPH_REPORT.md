# Graph Report - nx-monorepo-experiment  (2026-04-26)

## Corpus Check
- 40 files · ~14,087 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 214 nodes · 262 edges · 14 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `DmComponent` - 47 edges
2. `ScenarioFormComponent` - 26 edges
3. `ChatComponent` - 17 edges
4. `ChatService` - 13 edges
5. `call_llm()` - 7 edges
6. `_extract_json_object()` - 7 edges
7. `chat()` - 7 edges
8. `AiAssistService` - 7 edges
9. `SettingsService` - 7 edges
10. `_parse_with_repair()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ChatResponse` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/chat.py
- `AssistResponse` --calls--> `assist()`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/generate.py
- `build_system_prompt()` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/prompts.py → apps/llama-proxy/routes/chat.py
- `build_interpersonal_system_prompt()` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/prompts.py → apps/llama-proxy/routes/chat.py
- `build_kickoff_prompt()` --calls--> `chat()`  [INFERRED]
  apps/llama-proxy/prompts.py → apps/llama-proxy/routes/chat.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (1): DmComponent

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (3): ErrorBoundaryComponent, PresetScenarioService, ScenarioFormComponent

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (17): chat(), assist(), generate_npc(), generate_quest(), generate_scenario(), _extract_json_object(), _fix_retry_messages(), _parse_with_repair() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (2): AiAssistService, ChatComponent

### Community 4 - "Community 4"
Cohesion: 0.21
Nodes (1): ChatService

### Community 5 - "Community 5"
Cohesion: 0.26
Nodes (13): BaseModel, AssistRequest, AssistResponse, BackendPatchRequest, ChatRequest, ChatResponse, GenerateNpcRequest, GenerateQuestRequest (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.21
Nodes (2): SettingsComponent, SettingsService

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (1): ScenarioService

### Community 9 - "Community 9"
Cohesion: 0.5
Nodes (1): MenuComponent

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (1): App

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): Remove markdown code fences from LLM output.

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (1): Find and return the first complete {...} JSON object in text.     More robust th

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (1): Build a fix-retry message list that gives the model clear instructions.

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): Hidden user message to trigger the opening narration when no messages exist.

## Knowledge Gaps
- **7 isolated node(s):** `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.`, `App`, `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 0`** (47 nodes): `dm.component.ts`, `DmComponent`, `.addEncounter()`, `.addMonster()`, `.addNpcAction()`, `.addNpcClass()`, `.addNpcListItem()`, `.addObjective()`, `.addRewardItem()`, `.deleteNpc()`, `.deleteQuest()`, `.difficultyClass()`, `.generateQuest()`, `.goBack()`, `.loadNpcs()`, `.loadQuests()`, `.newNpc()`, `.newQuest()`, `.removeEncounter()`, `.removeMonster()`, `.removeNpcAction()`, `.removeNpcClass()`, `.removeNpcListItem()`, `.removeObjective()`, `.removeRewardItem()`, `.saveNpc()`, `.saveQuest()`, `.saveToStorage()`, `.setTab()`, `.statKeys()`, `.statLabel()`, `.updateEncounterDesc()`, `._updateMonster()`, `.updateMonsterCr()`, `.updateMonsterName()`, `.updateNpcActionDesc()`, `.updateNpcActionName()`, `.updateNpcClassLevel()`, `.updateNpcClassName()`, `.updateNpcField()`, `.updateNpcListItem()`, `.updateNpcStat()`, `.updateObjective()`, `.updateQuestField()`, `.updateRewardGold()`, `.updateRewardItem()`, `.updateRewardSilver()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 3`** (21 nodes): `AiAssistService`, `.callAssist()`, `.generateNpc()`, `.generateQuest()`, `.rewriteInput()`, `.suggestInput()`, `chat.component.ts`, `ai-assist.service.ts`, `ChatComponent`, `.aiSuggestOrRewrite()`, `.cancelAction()`, `.focusInput()`, `.onInput()`, `.onKeydown()`, `.renderMarkdown()`, `.requestNew()`, `.requestReset()`, `.requestTrim()`, `.send()`, `.toggleInputType()`, `.toggleScenarioInfo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (18 nodes): `chat.service.ts`, `.confirmAction()`, `.executeChange()`, `.ngOnInit()`, `.requestChange()`, `ChatService`, `.appendToLastMessage()`, `.buildScenarioPayload()`, `.cancelStream()`, `.initializeStory()`, `.loadPersistedMessages()`, `.persistMessages()`, `.regenerateLastResponse()`, `.resetMessages()`, `.sendMessage()`, `.streamRequest()`, `.streamWithRetry()`, `.trimContext()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (13 nodes): `settings.component.ts`, `settings.service.ts`, `SettingsComponent`, `.goBack()`, `.ngOnInit()`, `.selectBackend()`, `SettingsService`, `.activeBackend()`, `.checkHealth()`, `.loadConfig()`, `._patchBackend()`, `.setActiveBackend()`, `.setEnableThinking()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (6 nodes): `scenario.service.ts`, `.start()`, `ScenarioService`, `.clearScenario()`, `.load()`, `.setScenario()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (4 nodes): `menu.component.ts`, `MenuComponent`, `.goToSettings()`, `.selectMode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `App`, `app.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Remove markdown code fences from LLM output.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `Find and return the first complete {...} JSON object in text.     More robust th`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `Build a fix-retry message list that gives the model clear instructions.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `Hidden user message to trigger the opening narration when no messages exist.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ScenarioFormComponent` connect `Community 1` to `Community 7`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `DmComponent` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **What connects `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.`, `App` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._