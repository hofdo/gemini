# Graph Report - nx-monorepo-experiment  (2026-04-25)

## Corpus Check
- 26 files · ~12,891 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 181 nodes · 226 edges · 9 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `DmComponent` - 47 edges
2. `ScenarioFormComponent` - 26 edges
3. `ChatComponent` - 12 edges
4. `ChatService` - 7 edges
5. `AiAssistService` - 7 edges
6. `_extract_json_object()` - 6 edges
7. `chat()` - 6 edges
8. `SettingsService` - 6 edges
9. `_fix_retry_messages()` - 5 edges
10. `call_llm()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (1): DmComponent

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (30): BaseModel, assist(), AssistRequest, AssistResponse, BackendPatchRequest, build_interpersonal_system_prompt(), build_kickoff_prompt(), build_system_prompt() (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (2): PresetScenarioService, ScenarioFormComponent

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (2): ChatComponent, ChatService

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (2): SettingsComponent, SettingsService

### Community 5 - "Community 5"
Cohesion: 0.36
Nodes (1): AiAssistService

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (1): ScenarioService

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (1): MenuComponent

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (1): App

## Knowledge Gaps
- **5 isolated node(s):** `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th`, `Build a fix-retry message list that gives the model clear instructions.`, `Hidden user message to trigger the opening narration when no messages exist.`, `App`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 0`** (44 nodes): `dm.component.ts`, `DmComponent`, `.addEncounter()`, `.addMonster()`, `.addNpcAction()`, `.addNpcClass()`, `.addNpcListItem()`, `.addObjective()`, `.addRewardItem()`, `.deleteNpc()`, `.deleteQuest()`, `.difficultyClass()`, `.generateQuest()`, `.goBack()`, `.loadNpcs()`, `.loadQuests()`, `.newNpc()`, `.newQuest()`, `.removeEncounter()`, `.removeMonster()`, `.removeNpcAction()`, `.removeNpcClass()`, `.removeNpcListItem()`, `.removeObjective()`, `.removeRewardItem()`, `.saveNpc()`, `.saveQuest()`, `.setTab()`, `.statKeys()`, `.statLabel()`, `.trackByIdx()`, `.updateEncounterDesc()`, `.updateNpcActionDesc()`, `.updateNpcActionName()`, `.updateNpcClassLevel()`, `.updateNpcClassName()`, `.updateNpcField()`, `.updateNpcListItem()`, `.updateNpcStat()`, `.updateObjective()`, `.updateQuestField()`, `.updateRewardGold()`, `.updateRewardItem()`, `.updateRewardSilver()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 2`** (32 nodes): `.generateScenario()`, `preset-scenario.service.ts`, `scenario-form.component.ts`, `.generateNpc()`, `PresetScenarioService`, `.loadIndex()`, `.loadScenario()`, `ScenarioFormComponent`, `.addNpc()`, `.addNpcFoe()`, `.addNpcFriend()`, `.addNpcPlotTwist()`, `.addRule()`, `.applyTypeValidators()`, `.constructor()`, `.generateNpcWithAi()`, `.generateWithAi()`, `.getNpcFoes()`, `.getNpcFriends()`, `.getNpcMode()`, `.getNpcPlotTwists()`, `.goBack()`, `.loadPreset()`, `.npcs()`, `.removeNpc()`, `.removeNpcFoe()`, `.removeNpcFriend()`, `.removeNpcPlotTwist()`, `.removeRule()`, `.resetForm()`, `.rules()`, `.toggleNpcMode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 3`** (21 nodes): `chat.component.ts`, `chat.service.ts`, `ChatComponent`, `.changeScenario()`, `.focusInput()`, `.newScenario()`, `.ngAfterViewChecked()`, `.ngOnInit()`, `.onKeydown()`, `.resetStory()`, `.send()`, `.toggleInputType()`, `.toggleScenarioInfo()`, `ChatService`, `.appendToLastMessage()`, `.buildScenarioPayload()`, `.initializeStory()`, `.resetMessages()`, `.sendMessage()`, `.streamRequest()`, `.clearScenario()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (12 nodes): `settings.component.ts`, `settings.service.ts`, `SettingsComponent`, `.goBack()`, `.ngOnInit()`, `.selectBackend()`, `SettingsService`, `.activeBackend()`, `.checkHealth()`, `.loadConfig()`, `._patchBackend()`, `.setActiveBackend()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 5`** (8 nodes): `AiAssistService`, `.callAssist()`, `.generateNpc()`, `.generateQuest()`, `.rewriteInput()`, `.suggestInput()`, `ai-assist.service.ts`, `.aiSuggestOrRewrite()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (5 nodes): `scenario.service.ts`, `.start()`, `ScenarioService`, `.load()`, `.setScenario()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (5 nodes): `menu.component.ts`, `MenuComponent`, `.constructor()`, `.goToSettings()`, `.selectMode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `App`, `app.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ScenarioFormComponent` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.270) - this node is a cross-community bridge._
- **Why does `DmComponent` connect `Community 0` to `Community 9`, `Community 2`?**
  _High betweenness centrality (0.253) - this node is a cross-community bridge._
- **Why does `AiAssistService` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th`, `Build a fix-retry message list that gives the model clear instructions.` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._