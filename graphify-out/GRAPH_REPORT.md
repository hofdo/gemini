# Graph Report - .  (2026-04-24)

## Corpus Check
- Corpus is ~17,020 words - fits in a single context window. You may not need a graph.

## Summary
- 289 nodes · 358 edges · 31 communities detected
- Extraction: 89% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dungeon Master Component|Dungeon Master Component]]
- [[_COMMUNITY_FastAPI LLM Proxy|FastAPI LLM Proxy]]
- [[_COMMUNITY_Second Brain & Documentation|Second Brain & Documentation]]
- [[_COMMUNITY_AI Content Generation|AI Content Generation]]
- [[_COMMUNITY_Chat Logic & Service|Chat Logic & Service]]
- [[_COMMUNITY_Backend Settings|Backend Settings]]
- [[_COMMUNITY_UI Detail Components|UI Detail Components]]
- [[_COMMUNITY_AI Assist Service|AI Assist Service]]
- [[_COMMUNITY_Config Endpoints & Nav|Config Endpoints & Nav]]
- [[_COMMUNITY_Scenario State Management|Scenario State Management]]
- [[_COMMUNITY_Main Menu Navigation|Main Menu Navigation]]
- [[_COMMUNITY_DM Template Shell|DM Template Shell]]
- [[_COMMUNITY_Quest Result Details|Quest Result Details]]
- [[_COMMUNITY_App Root Component|App Root Component]]
- [[_COMMUNITY_Chat Send Flow|Chat Send Flow]]
- [[_COMMUNITY_NPC Generation|NPC Generation]]
- [[_COMMUNITY_HTML Shell|HTML Shell]]
- [[_COMMUNITY_Router Outlet|Router Outlet]]
- [[_COMMUNITY_Backend Switch Action|Backend Switch Action]]
- [[_COMMUNITY_Scenario to Chat Bridge|Scenario to Chat Bridge]]
- [[_COMMUNITY_AI Suggest|AI Suggest]]
- [[_COMMUNITY_Scenario Generation|Scenario Generation]]
- [[_COMMUNITY_Quest Generation|Quest Generation]]
- [[_COMMUNITY_Menu Settings Navigation|Menu Settings Navigation]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]

## God Nodes (most connected - your core abstractions)
1. `DmComponent` - 48 edges
2. `ScenarioFormComponent` - 26 edges
3. `ChatComponent` - 13 edges
4. `Wiki Index` - 11 edges
5. `llama-proxy FastAPI Backend` - 10 edges
6. `LLM Backend Switching` - 9 edges
7. `ChatService` - 8 edges
8. `AiAssistService` - 8 edges
9. `Dungeon Master Mode` - 8 edges
10. `_extract_json_object()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `llama-chat Angular App` --calls--> `llama-proxy FastAPI Backend`  [EXTRACTED]
  CLAUDE.md → project/wiki/entities/llama-proxy.md
- `Three-Tier Architecture` --references--> `llama-chat Angular App`  [EXTRACTED]
  project/wiki/entities/architecture.md → CLAUDE.md
- `Backend Parameter Grid (temperature/top_p/top_k/repeat_penalty)` --semantically_similar_to--> `DM NPC Stats Grid (STR/DEX/CON/INT/WIS/CHA)`  [AMBIGUOUS] [semantically similar]
  apps/llama-chat/src/app/settings/settings.component.html → apps/llama-chat/src/app/dm/dm.component.html
- `CLAUDE.md Second Brain Schema` --references--> `Wiki Index`  [EXTRACTED]
  CLAUDE.md → project/wiki/index.md
- `CLAUDE.md Second Brain Schema` --references--> `Wiki Session Log`  [EXTRACTED]
  CLAUDE.md → project/wiki/log.md

## Hyperedges (group relationships)
- **Three-Tier LLM Request Flow** — llama_chat_app, entity_llama_proxy, llm_server [EXTRACTED 1.00]
- **Dual NPC Creation Paths (DmComponent + ScenarioForm via AiAssistService)** — entity_dm_component, scenario_form_component, entity_ai_assist_service [EXTRACTED 0.90]
- **Runtime Backend Switching Stack** — entity_settings_service, entity_llama_proxy, concept_backend_switching [EXTRACTED 1.00]
- **Chat Message Send Flow (input type → textarea → send → /chat endpoint)** — chat_input_type_toggle, chat_input_row, chat_btn_send, endpoint_chat [INFERRED 0.85]
- **Scenario Creation to Chat Flow (menu → scenario form → start → chat)** — menu_mode_adventure, scenario_form_template, scenario_btn_start, chat_template [INFERRED 0.80]
- **DM NPC Generation Flow (creator form → /generate-npc → result card with stats)** — dm_npc_creator, dm_btn_generate_npc, endpoint_generate_npc, dm_npc_result_card, dm_npc_stats_grid [INFERRED 0.85]

## Communities

### Community 0 - "Dungeon Master Component"
Cohesion: 0.04
Nodes (1): DmComponent

### Community 1 - "FastAPI LLM Proxy"
Cohesion: 0.14
Nodes (34): BaseModel, assist(), AssistRequest, AssistResponse, BackendPatchRequest, build_interpersonal_system_prompt(), build_kickoff_prompt(), build_system_prompt() (+26 more)

### Community 2 - "Second Brain & Documentation"
Cohesion: 0.14
Nodes (30): Bug Fix: llama-proxy Missing uncensored Config, CLAUDE.md Second Brain Schema, LLM Backend Switching, Dungeon Master Mode, NPC Duplication — Two Creation Flows, DM Data Models (dm.model.ts), AiAssistService, Three-Tier Architecture (+22 more)

### Community 3 - "AI Content Generation"
Cohesion: 0.1
Nodes (1): ScenarioFormComponent

### Community 4 - "Chat Logic & Service"
Cohesion: 0.14
Nodes (2): ChatComponent, ChatService

### Community 5 - "Backend Settings"
Cohesion: 0.19
Nodes (2): SettingsComponent, SettingsService

### Community 6 - "UI Detail Components"
Cohesion: 0.17
Nodes (13): Chat Edit Scenario Button (changeScenario), Chat New Scenario Button (newScenario), DM NPC Result Card (editable fields), DM NPC Stats Grid (STR/DEX/CON/INT/WIS/CHA), DM Saved NPCs Collection, Menu Adventure Mode Button (selectMode adventure), Menu Interpersonal Mode Button (selectMode interpersonal), Scenario Adventure NPCs Section (+5 more)

### Community 7 - "AI Assist Service"
Cohesion: 0.31
Nodes (1): AiAssistService

### Community 8 - "Config Endpoints & Nav"
Cohesion: 0.29
Nodes (7): GET /config/backends Endpoint, GET /health Endpoint, Menu Settings Button (goToSettings), Backend Selection List UI, Proxy Status Indicator, settings.service Signal (proxyReachable/backends/activeId/loading), Settings Component Template

### Community 9 - "Scenario State Management"
Cohesion: 0.33
Nodes (1): ScenarioService

### Community 10 - "Main Menu Navigation"
Cohesion: 0.33
Nodes (1): MenuComponent

### Community 11 - "DM Template Shell"
Cohesion: 0.4
Nodes (5): DM NPC Creator Form, DM Quest Creator Form, DM Tab Bar (Quests / NPCs tabs), DM Component Template, Menu Dungeon Master Mode Button (selectMode dm)

### Community 12 - "Quest Result Details"
Cohesion: 0.5
Nodes (4): DM Quest Encounters Section (monster table), DM Quest Result Card (editable fields), DM Quest Rewards Section (gold/silver/items), DM Saved Quests Collection

### Community 14 - "App Root Component"
Cohesion: 0.67
Nodes (1): App

### Community 16 - "Chat Send Flow"
Cohesion: 0.67
Nodes (3): Chat Send Button (send), Chat Input Mode Toggle (dialogue/action/direct), POST /chat Endpoint

### Community 17 - "NPC Generation"
Cohesion: 0.67
Nodes (3): DM Generate NPC Button (generateNpc), POST /generate-npc Endpoint, Scenario NPC AI Generate Button (generateNpcWithAi)

### Community 18 - "HTML Shell"
Cohesion: 1.0
Nodes (2): App Entry Point (index.html), llama-root Custom Element

### Community 19 - "Router Outlet"
Cohesion: 1.0
Nodes (2): App Root Template (app.html), Angular Router Outlet

### Community 20 - "Backend Switch Action"
Cohesion: 1.0
Nodes (2): PATCH /config/backend Endpoint, Backend Card (selectBackend button)

### Community 21 - "Scenario to Chat Bridge"
Cohesion: 1.0
Nodes (2): Chat Component Template, Scenario Start Story Submit Button

### Community 22 - "AI Suggest"
Cohesion: 1.0
Nodes (2): Chat AI Suggest/Rewrite Button (aiSuggestOrRewrite), POST /assist Endpoint

### Community 23 - "Scenario Generation"
Cohesion: 1.0
Nodes (2): POST /generate-scenario Endpoint, Scenario AI Generate Section (generateWithAi button)

### Community 24 - "Quest Generation"
Cohesion: 1.0
Nodes (2): DM Generate Quest Button (generateQuest), POST /generate-quest Endpoint

### Community 25 - "Menu Settings Navigation"
Cohesion: 1.0
Nodes (2): Menu Component Template, Settings Back Button (goBack)

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (1): Chat Header (title/scenario badge/actions)

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (1): Scenario Info Expandable Panel

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (1): Chat Message List

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (1): Chat Input Row (textarea + send + AI + mode toggle)

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (1): Chat Reset Story Button (resetStory)

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (1): Scenario Character Section (name/description)

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (1): Scenario Rules Section

## Ambiguous Edges - Review These
- `Backend Parameter Grid (temperature/top_p/top_k/repeat_penalty)` → `DM NPC Stats Grid (STR/DEX/CON/INT/WIS/CHA)`  [AMBIGUOUS]
  apps/llama-chat/src/app/settings/settings.component.html · relation: semantically_similar_to

## Knowledge Gaps
- **54 isolated node(s):** `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th`, `Build a fix-retry message list that gives the model clear instructions.`, `Hidden user message to trigger the opening narration when no messages exist.`, `NxMonorepoExperiment README` (+49 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Dungeon Master Component`** (48 nodes): `dm.component.ts`, `DmComponent`, `.addEncounter()`, `.addMonster()`, `.addNpcAction()`, `.addNpcClass()`, `.addNpcListItem()`, `.addObjective()`, `.addRewardItem()`, `.deleteNpc()`, `.deleteQuest()`, `.difficultyClass()`, `.generateQuest()`, `.goBack()`, `.loadNpcs()`, `.loadQuests()`, `.newNpc()`, `.newQuest()`, `.removeEncounter()`, `.removeMonster()`, `.removeNpcAction()`, `.removeNpcClass()`, `.removeNpcListItem()`, `.removeObjective()`, `.removeRewardItem()`, `.saveNpc()`, `.saveQuest()`, `.setTab()`, `.statKeys()`, `.statLabel()`, `.trackByIdx()`, `.updateEncounterDesc()`, `._updateMonster()`, `.updateMonsterCr()`, `.updateMonsterName()`, `.updateNpcActionDesc()`, `.updateNpcActionName()`, `.updateNpcClassLevel()`, `.updateNpcClassName()`, `.updateNpcField()`, `.updateNpcListItem()`, `.updateNpcStat()`, `.updateObjective()`, `.updateQuestField()`, `.updateRewardGold()`, `.updateRewardItem()`, `.updateRewardSilver()`, `dm.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Content Generation`** (28 nodes): `.generateScenario()`, `scenario-form.component.ts`, `.generateNpc()`, `ScenarioFormComponent`, `.addNpc()`, `.addNpcFoe()`, `.addNpcFriend()`, `.addNpcPlotTwist()`, `.addRule()`, `.applyTypeValidators()`, `.constructor()`, `.generateNpcWithAi()`, `.generateWithAi()`, `.getNpcFoes()`, `.getNpcFriends()`, `.getNpcMode()`, `.getNpcPlotTwists()`, `.goBack()`, `.npcs()`, `.removeNpc()`, `.removeNpcFoe()`, `.removeNpcFriend()`, `.removeNpcPlotTwist()`, `.removeRule()`, `.resetForm()`, `.rules()`, `.toggleNpcMode()`, `scenario-form.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chat Logic & Service`** (23 nodes): `chat.component.ts`, `chat.service.ts`, `ChatComponent`, `.changeScenario()`, `.focusInput()`, `.newScenario()`, `.ngAfterViewChecked()`, `.ngOnInit()`, `.onKeydown()`, `.resetStory()`, `.send()`, `.toggleInputType()`, `.toggleScenarioInfo()`, `ChatService`, `.appendToLastMessage()`, `.buildScenarioPayload()`, `.initializeStory()`, `.resetMessages()`, `.sendMessage()`, `.streamRequest()`, `.clearScenario()`, `chat.component.ts`, `chat.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backend Settings`** (14 nodes): `settings.component.ts`, `settings.service.ts`, `SettingsComponent`, `.goBack()`, `.ngOnInit()`, `.selectBackend()`, `SettingsService`, `.activeBackend()`, `.checkHealth()`, `.loadConfig()`, `._patchBackend()`, `.setActiveBackend()`, `settings.component.ts`, `settings.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Assist Service`** (9 nodes): `AiAssistService`, `.callAssist()`, `.generateNpc()`, `.generateQuest()`, `.rewriteInput()`, `.suggestInput()`, `ai-assist.service.ts`, `.aiSuggestOrRewrite()`, `ai-assist.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scenario State Management`** (6 nodes): `scenario.service.ts`, `.start()`, `ScenarioService`, `.load()`, `.setScenario()`, `scenario.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Main Menu Navigation`** (6 nodes): `menu.component.ts`, `MenuComponent`, `.constructor()`, `.goToSettings()`, `.selectMode()`, `menu.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Root Component`** (3 nodes): `App`, `app.ts`, `app.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTML Shell`** (2 nodes): `App Entry Point (index.html)`, `llama-root Custom Element`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Router Outlet`** (2 nodes): `App Root Template (app.html)`, `Angular Router Outlet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backend Switch Action`** (2 nodes): `PATCH /config/backend Endpoint`, `Backend Card (selectBackend button)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scenario to Chat Bridge`** (2 nodes): `Chat Component Template`, `Scenario Start Story Submit Button`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Suggest`** (2 nodes): `Chat AI Suggest/Rewrite Button (aiSuggestOrRewrite)`, `POST /assist Endpoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scenario Generation`** (2 nodes): `POST /generate-scenario Endpoint`, `Scenario AI Generate Section (generateWithAi button)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Quest Generation`** (2 nodes): `DM Generate Quest Button (generateQuest)`, `POST /generate-quest Endpoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Menu Settings Navigation`** (2 nodes): `Menu Component Template`, `Settings Back Button (goBack)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `Chat Header (title/scenario badge/actions)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `Scenario Info Expandable Panel`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `Chat Message List`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `Chat Input Row (textarea + send + AI + mode toggle)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `Chat Reset Story Button (resetStory)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `Scenario Character Section (name/description)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `Scenario Rules Section`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Backend Parameter Grid (temperature/top_p/top_k/repeat_penalty)` and `DM NPC Stats Grid (STR/DEX/CON/INT/WIS/CHA)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `ScenarioFormComponent` connect `AI Content Generation` to `Scenario State Management`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `DmComponent` connect `Dungeon Master Component` to `AI Content Generation`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `AiAssistService` connect `AI Assist Service` to `AI Content Generation`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th`, `Build a fix-retry message list that gives the model clear instructions.` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dungeon Master Component` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `FastAPI LLM Proxy` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._