from typing import Literal

from pydantic import BaseModel, Field


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


class StoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    input_type: Literal["dialogue", "action", "direct"] = "dialogue"


class ChatRequest(BaseModel):
    messages: list[StoryMessage]
    scenario: Scenario | None = None
    world_state: "WorldStateModel | None" = None
    stream: bool = False
    enable_thinking: bool = False


class ChatResponse(BaseModel):
    reply: str


class AssistRequest(BaseModel):
    mode: Literal["suggest", "rewrite"]
    current_text: str = ""
    input_type: Literal["dialogue", "action", "direct"] = "dialogue"
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


class FactionState(BaseModel):
    id: str
    name: str
    archetypes: list[str] = []
    standing: int = 0
    territories: list[str] = []
    allies: list[str] = []
    enemies: list[str] = []
    notes: str = ""


class NpcRelationship(BaseModel):
    target_npc_id: str
    disposition: int = 0
    note: str = ""


class NpcStateModel(BaseModel):
    npc_id: str
    name: str
    status: Literal["alive", "dead", "missing", "unknown"] = "alive"
    location_id: str | None = None
    disposition: int = 0
    relationships: list[NpcRelationship] = []
    known_facts: list[str] = []
    notes: str = ""


class StoryEventModel(BaseModel):
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


class WorldLocationModel(BaseModel):
    id: str
    name: str
    description: str
    faction_control: str | None = None
    current_events: list[str] = []
    visit_count: int = 0


class CurrentSceneModel(BaseModel):
    location_id: str | None = None
    present_npc_ids: list[str] = []
    tension: Literal["calm", "tense", "hostile", "combat"] = "calm"
    scene_note: str = ""


class WorldClockModel(BaseModel):
    day_number: int = 1
    time_of_day: Literal["dawn", "morning", "afternoon", "evening", "night"] = "morning"
    season: Literal["spring", "summer", "autumn", "winter"] = "spring"
    turns_per_day: int = 8


class WorldStateModel(BaseModel):
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


class WorldStateDelta(BaseModel):
    faction_changes: list[FactionChange] = []
    npc_changes: list[NpcChange] = []
    new_events: list[StoryEventModel] = []
    scene_update: SceneUpdate | None = None
    clock_advance: bool = False
    key_facts_append: list[str] = []


class WorldStateUpdateRequest(BaseModel):
    scenario: Scenario
    world_state: WorldStateModel
    last_exchanges: list[StoryMessage]
