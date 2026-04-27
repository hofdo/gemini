from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """Accept camelCase keys from the Angular frontend."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class NPCStats(BaseModel):
    model_config = {"populate_by_name": True}

    str_val: int | None = Field(default=None, alias="str")
    dex: int | None = None
    con: int | None = None
    int_val: int | None = Field(default=None, alias="int")
    wis: int | None = None
    cha: int | None = None


class NPC(BaseModel):
    name: str
    description: str
    mode: Literal["simple", "detailed"] = "simple"
    stats: NPCStats | None = None
    personality: str = ""
    foes: list[str] = []
    friends: list[str] = []
    plot_twists: list[str] = []


class Scenario(BaseModel):
    scenario_type: Literal["adventure", "interpersonal"] = "adventure"
    title: str
    setting: str
    tone: str
    character_name: str
    character_description: str
    npcs: list[NPC] = []
    rules: list[str] = []
    partner_name: str = ""
    partner_gender: str = ""
    partner_personality: str = ""
    partner_body_description: str = ""
    partner_appearance: str = ""
    partner_relationship: str = ""
    partner_likes: str = ""
    partner_dislikes: str = ""
    partner_turn_ons: str = ""


# Phase 3a: Ambient event
class AmbientEvent(BaseModel):
    text: str
    generated_at: str = ""


# Phase 3c: Tone settings
class ToneSettings(BaseModel):
    pacing: Literal["cinematic", "deliberate"] = "deliberate"
    register: Literal["gritty", "balanced", "mythic"] = "balanced"
    boundary: Literal["fade", "standard", "unfiltered"] = "standard"


# Phase 3d: Bond mode
class BondUpdate(BaseModel):
    tier_delta: int = 0
    temperature_change: Literal["cold", "warm", "charged", "tender", "raw"] | None = None
    new_milestone: str | None = None
    new_anchor: str | None = None
    companion_mood_update: str | None = None


class BondStateModel(BaseModel):
    tier: int = 0
    temperature: Literal["cold", "warm", "charged", "tender", "raw"] = "warm"
    milestones: list[str] = []
    companion_mood: str = ""


class CombatParticipant(BaseModel):
    entity_id: str
    name: str
    initiative: int = 0
    hp: dict = {"current": 10, "max": 10}
    is_player: bool = False


class CombatStateModel(BaseModel):
    active: bool = False
    round: int = 1
    initiative_order: list[CombatParticipant] = []
    active_entity_index: int = 0
    log: list[str] = []


class CombatDelta(BaseModel):
    action: Literal["start", "next_turn", "end"] = "start"
    hp_changes: list[dict] = []
    round_log_append: str | None = None
    removed_entity_ids: list[str] = []


class StoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    input_type: Literal["dialogue", "action", "direct", "remember"] = "dialogue"


class ChatRequest(BaseModel):
    messages: list[StoryMessage]
    scenario: Scenario | None = None
    world_state: "WorldStateModel | None" = None
    stream: bool = False
    enable_thinking: bool = False
    tone_settings: ToneSettings = Field(default_factory=ToneSettings)


class ChatResponse(BaseModel):
    reply: str


class AssistRequest(BaseModel):
    mode: Literal["suggest", "rewrite"]
    current_text: str = ""
    input_type: Literal["dialogue", "action", "direct", "remember"] = "dialogue"
    scenario: Scenario | None = None
    messages: list[StoryMessage] = []


class AssistResponse(BaseModel):
    text: str


class GenerateScenarioRequest(BaseModel):
    description: str
    scenario_type: Literal["adventure", "interpersonal"] = "adventure"


class GenerateNpcRequest(BaseModel):
    npc_name: str = ""
    npc_description: str = ""
    setting: str = ""
    tone: str = ""
    title: str = ""


class GenerateQuestRequest(BaseModel):
    prompt: str
    setting: str = ""
    tone: str = ""
    party_level: int | None = None


class BackendPatchRequest(BaseModel):
    id: str


class FactionState(_CamelModel):
    id: str
    name: str
    archetypes: list[str] = []
    standing: int = 0
    territories: list[str] = []
    allies: list[str] = []
    enemies: list[str] = []
    notes: str = ""


class NpcRelationship(_CamelModel):
    target_npc_id: str
    disposition: int = 0
    note: str = ""


class NpcStateModel(_CamelModel):
    npc_id: str
    name: str
    status: Literal["alive", "dead", "missing", "unknown"] = "alive"
    location_id: str | None = None
    disposition: int = 0
    relationships: list[NpcRelationship] = []
    known_facts: list[str] = []
    notes: str = ""


class StoryEventModel(_CamelModel):
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


class WorldLocationModel(_CamelModel):
    id: str
    name: str
    description: str
    faction_control: str | None = None
    current_events: list[str] = []
    visit_count: int = 0


class CurrentSceneModel(_CamelModel):
    location_id: str | None = None
    present_npc_ids: list[str] = []
    tension: Literal["calm", "tense", "hostile", "combat"] = "calm"
    scene_note: str = ""


class WorldClockModel(_CamelModel):
    day_number: int = 1
    time_of_day: Literal["dawn", "morning", "afternoon", "evening", "night"] = "morning"
    season: Literal["spring", "summer", "autumn", "winter"] = "spring"
    turns_per_day: int = 8


class QuestObjective(BaseModel):
    text: str
    done: bool = False


class QuestEntry(BaseModel):
    id: str
    title: str
    description: str
    status: Literal["active", "completed", "failed", "abandoned"] = "active"
    objectives: list[QuestObjective] = []
    added_at_turn: int = 0
    resolved_at_turn: int | None = None
    linked_npc_ids: list[str] = []
    rewards: dict | None = None


class AptitudeSet(BaseModel):
    bold: int = 0
    subtle: int = 0
    learned: int = 0
    connected: int = 0
    fierce: int = 0
    resilient: int = 0


class PlayerCharacterModel(BaseModel):
    name: str
    epithets: list[str] = []
    aptitudes: AptitudeSet = AptitudeSet()
    scars_and_glories: list[str] = []
    inventory: list[str] = []
    conditions: list[str] = []
    hp: dict = {"current": 20, "max": 20}


class QuestUpdate(BaseModel):
    quest_id: str
    new_status: Literal["active", "completed", "failed", "abandoned"] | None = None
    objectives_done: list[int] = []
    notes_append: str = ""


class PlayerUpdate(BaseModel):
    hp_delta: int | None = None
    conditions_add: list[str] = []
    conditions_remove: list[str] = []
    inventory_add: list[str] = []
    inventory_remove: list[str] = []


class WorldStateModel(_CamelModel):
    schema_version: int = 1
    id: str
    scenario_title: str
    current_scene: CurrentSceneModel | None = None
    world_clock: WorldClockModel = WorldClockModel()
    factions: list[FactionState] = []
    locations: list[WorldLocationModel] = []
    npc_states: list[NpcStateModel] = []
    story_events: list[StoryEventModel] = []
    archived_event_count: int = 0
    archived_event_summary: str = ""
    key_facts: list[str] = []
    turn_count: int = 0
    quest_log: list[QuestEntry] = []
    player_character: PlayerCharacterModel | None = None
    choice_chronicle: list[str] = []
    story_beat: str | None = None
    # Phase 3a: Heartbeat
    ambient_queue: list[AmbientEvent] = []
    # Phase 3d: Bond mode
    bond_state: BondStateModel | None = None
    combat_state: CombatStateModel | None = None


class FactionChange(BaseModel):
    faction_id: str
    standing_delta: int = 0
    notes_append: str = ""


class NpcChange(BaseModel):
    npc_id: str
    new_status: Literal["alive", "dead", "missing", "unknown"] | None = None
    disposition_delta: int = 0
    new_known_facts: list[str] = []
    notes_append: str = ""


class SceneUpdate(BaseModel):
    location_id: str | None = None
    add_npc_ids: list[str] = []
    remove_npc_ids: list[str] = []
    new_tension: Literal["calm", "tense", "hostile", "combat"] | None = None
    scene_note: str = ""


class ClockAdvance(BaseModel):
    turns: int = 1


class WorldStateDelta(BaseModel):
    faction_changes: list[FactionChange] = []
    npc_changes: list[NpcChange] = []
    new_events: list[StoryEventModel] = []
    scene_update: SceneUpdate | None = None
    clock_advance: ClockAdvance | None = None
    key_facts_append: list[str] = []
    quest_updates: list[QuestUpdate] = []
    player_update: PlayerUpdate | None = None
    story_beat_update: str | None = None
    # Phase 3a: Heartbeat additions
    ambient_inject: str | None = None
    npc_rumors: list[StoryEventModel] = []
    faction_drift: list[FactionChange] = []
    # Phase 3d: Bond mode
    bond_update: BondUpdate | None = None
    combat_delta: CombatDelta | None = None


class WorldStateUpdateRequest(BaseModel):
    scenario: Scenario
    world_state: WorldStateModel
    last_exchanges: list[StoryMessage]
