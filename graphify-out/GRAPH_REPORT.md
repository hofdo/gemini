# Graph Report - nx-monorepo-experiment  (2026-05-02)

## Corpus Check
- 168 files · ~54,170 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 714 nodes · 1216 edges · 30 communities detected
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 452 edges (avg confidence: 0.77)
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
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]

## God Nodes (most connected - your core abstractions)
1. `DmComponent` - 64 edges
2. `ScenarioFormComponent` - 26 edges
3. `ChatComponent` - 26 edges
4. `WorldStateService` - 23 edges
5. `StorySessionService` - 22 edges
6. `StoryWorkspaceComponent` - 22 edges
7. `SessionZeroComponent` - 19 edges
8. `Scenario` - 18 edges
9. `ChatService` - 14 edges
10. `call_llm()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Scenario` --uses--> `GenerateFactionSetRequest`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/generate.py
- `Scenario` --uses--> `GenerateOpeningSceneRequest`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/generate.py
- `Scenario` --uses--> `GenerateOracleRequest`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/generate.py
- `Scenario` --uses--> `CombatParticipantPayload`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/combat.py
- `Scenario` --uses--> `CombatStatePayload`  [INFERRED]
  apps/llama-proxy/models.py → apps/llama-proxy/routes/combat.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (3): DmComponent, dmNpcToNpcState(), dmQuestToQuestEntry()

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (9): BondStateService, CombatStateService, FactionStateService, LoadingBusService, NpcStateService, PlayerStateService, QuestStateService, standingLabel() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (52): BaseModel, CombatParticipantPayload, CombatResolution, CombatResolveRequest, CombatStatePayload, resolve_combat_turn(), GenerateFactionSetRequest, GenerateOpeningSceneRequest (+44 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (5): PresetScenarioService, ScenarioApiService, ScenarioFormComponent, ScenarioService, ScenarioWizardComponent

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (18): makeAssistantMessage(), makeDefaultScenario(), makeEmptyWorldState(), makeStorySession(), makeUserMessage(), newId(), nowIso(), StoryProviderService (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (4): ChatService, ErrorBoundaryComponent, SessionService, WorldSyncService

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (5): AdventureScenarioEditorComponent, cloneScenario(), makeScenarioSeed(), Scenario, SessionZeroComponent

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (5): AdventureAssistService, App, AppErrorService, ChatRenderingService, StoryWorkspaceComponent

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (26): build_tone_fragment(), chat(), assist(), generate_faction_set(), generate_npc(), generate_opening_scene(), generate_oracle(), generate_quest() (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (5): start(), openStoryDb(), StorySessionRepository, StorageService, WorldStateStore

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (2): CombatComponent, CombatService

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (8): extractChunkText(), extractResponseText(), PuterChatProviderService, toPuterMessages(), extractContent(), loadPuterScript(), parseJsonFromPuterResponse(), PuterStoryProvider

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (2): ChatAssistService, ChatComponent

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (2): SettingsComponent, SettingsService

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (7): buildApp(), normalizeScenarioCandidate(), parseScenarioResponse(), createBackendStore(), extractJsonObject(), parseJsonObject(), createLlmClient()

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (2): LocalStoryProvider, toDtoMessages()

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (1): JournalComponent

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (1): WorldPanelComponent

### Community 19 - "Community 19"
Cohesion: 0.6
Nodes (5): buildChatMessages(), buildKickoffPrompt(), buildSystemPrompt(), buildToneFragment(), toApiMessage()

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (1): MenuComponent

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (1): ActionPanelComponent

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (1): DmToolsService

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (1): NpcApiService

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (1): DmApiService

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (1): InitiativeTrackerComponent

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (1): CombatLogComponent

### Community 104 - "Community 104"
Cohesion: 1.0
Nodes (1): Remove markdown code fences from LLM output.

### Community 105 - "Community 105"
Cohesion: 1.0
Nodes (1): Find and return the first complete {...} JSON object in text.     More robust th

### Community 106 - "Community 106"
Cohesion: 1.0
Nodes (1): Build a fix-retry message list that gives the model clear instructions.

### Community 107 - "Community 107"
Cohesion: 1.0
Nodes (1): Hidden user message to trigger the opening narration when no messages exist.

## Knowledge Gaps
- **7 isolated node(s):** `Accept camelCase keys from the Angular frontend.`, `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.`, `Remove markdown code fences from LLM output.`, `Find and return the first complete {...} JSON object in text.     More robust th` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (23 nodes): `combat.service.ts`, `combat.component.ts`, `.enterCombat()`, `CombatComponent`, `.endCombat()`, `.isSelected()`, `.ngOnInit()`, `.npcNameById()`, `.onAction()`, `.onEndCombat()`, `.onResolveTurn()`, `.onStartCombat()`, `.toggleNpc()`, `CombatService`, `.buildScenarioPayload()`, `.derivePlayerCharacterFromScenario()`, `.resolveTurn()`, `.rollInitiative()`, `.startCombat()`, `combat.component.ts`, `combat.service.ts`, `.applyCombatDelta()`, `.setCombatState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (21 nodes): `ChatAssistService`, `.callAssist()`, `.rewriteInput()`, `.suggestInput()`, `ChatComponent`, `.aiSuggestOrRewrite()`, `.cancelAction()`, `.dismissContextBanner()`, `.dismissContradictions()`, `.focusInput()`, `.ngOnDestroy()`, `.onInput()`, `.onKeydown()`, `.renderMarkdown()`, `.requestNew()`, `.requestReset()`, `.requestTrim()`, `.send()`, `.setWorldTab()`, `chat-assist.service.ts`, `chat.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (15 nodes): `settings.component.ts`, `settings.service.ts`, `SettingsComponent`, `.goBack()`, `.ngOnInit()`, `.selectBackend()`, `.updateTone()`, `SettingsService`, `.activeBackend()`, `.checkHealth()`, `.constructor()`, `.loadConfig()`, `._patchBackend()`, `.setActiveBackend()`, `.setEnableThinking()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (11 nodes): `local-story.provider.ts`, `LocalStoryProvider`, `.cancelGeneration()`, `.extractWorldDelta()`, `.generateOracle()`, `.generateScenario()`, `.streamChat()`, `.summarizeSession()`, `toDtoMessages()`, `.generate()`, `.stop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (8 nodes): `journal.component.ts`, `JournalComponent`, `.aptitudeKeys()`, `.certaintyIcon()`, `.goBack()`, `.setTab()`, `.toggleObjective()`, `journal.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (7 nodes): `world-panel.component.ts`, `world-panel.component.ts`, `WorldPanelComponent`, `.findNpcById()`, `.setTab()`, `.standingColor()`, `.standingLabel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (5 nodes): `menu.component.ts`, `MenuComponent`, `.goToJournal()`, `.goToSettings()`, `.selectMode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (4 nodes): `ActionPanelComponent`, `.emitAction()`, `.submitText()`, `action-panel.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (4 nodes): `dm-tools.service.ts`, `DmToolsService`, `.generateNpc()`, `.generateQuest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (3 nodes): `npc-api.service.ts`, `NpcApiService`, `.generateNpc()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (3 nodes): `DmApiService`, `.generateQuest()`, `dm-api.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (3 nodes): `InitiativeTrackerComponent`, `.hpPercent()`, `initiative-tracker.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (3 nodes): `CombatLogComponent`, `.ngAfterViewChecked()`, `combat-log.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (1 nodes): `Remove markdown code fences from LLM output.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (1 nodes): `Find and return the first complete {...} JSON object in text.     More robust th`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (1 nodes): `Build a fix-retry message list that gives the model clear instructions.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 107`** (1 nodes): `Hidden user message to trigger the opening narration when no messages exist.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Scenario` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `_build_world_state_block()` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `chat()` connect `Community 8` to `Community 2`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `Accept camelCase keys from the Angular frontend.`, `Find and return the first complete {...} JSON object in text.`, `Parse JSON with json-repair fallback for malformed LLM output.` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._