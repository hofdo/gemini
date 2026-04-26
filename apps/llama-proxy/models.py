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
