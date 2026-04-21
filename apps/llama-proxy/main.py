import json
import logging
import os
from typing import AsyncGenerator, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

LLAMA_CPP_URL = os.getenv("LLAMA_CPP_URL", "http://localhost:8080")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("llama-proxy")

app = FastAPI(title="llama-proxy", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

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
    input_type: Literal["dialogue", "action"] = "dialogue"


class ChatRequest(BaseModel):
    messages: list[StoryMessage]
    scenario: Scenario | None = None
    stream: bool = False


class ChatResponse(BaseModel):
    reply: str


class AssistRequest(BaseModel):
    mode: Literal["suggest", "rewrite"]
    current_text: str = ""
    input_type: Literal["dialogue", "action"] = "dialogue"
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


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(scenario: Scenario) -> str:
    npc_lines = []
    for n in scenario.npcs:
        line = f"- {n.name}: {n.description}"
        if n.mode == "detailed":
            if n.personality:
                line += f" | Personality: {n.personality}"
            if n.stats:
                stat_parts = []
                for attr, label in (("str_val", "STR"), ("dex", "DEX"), ("con", "CON"), ("int_val", "INT"), ("wis", "WIS"), ("cha", "CHA")):
                    val = getattr(n.stats, attr, None)
                    if val is not None:
                        stat_parts.append(f"{label}:{val}")
                if stat_parts:
                    line += f" | Stats: {', '.join(stat_parts)}"
            if n.foes:
                line += f" | Foes: {', '.join(n.foes)}"
            if n.friends:
                line += f" | Friends: {', '.join(n.friends)}"
            if n.plot_twists:
                line += f" | Plot twists: {'; '.join(n.plot_twists)}"
        npc_lines.append(line)
    npc_block = "\n".join(npc_lines) or "None defined."
    rules_block = "\n".join(f"- {r}" for r in scenario.rules) or "None."
    return (
        "You are the storyteller and game master of an interactive story.\n\n"
        f"## Story: {scenario.title}\n\n"
        f"### Setting\n{scenario.setting}\n\n"
        f"### Tone\n{scenario.tone}\n\n"
        f"### Player Character\n"
        f"Name: {scenario.character_name}\n"
        f"Description: {scenario.character_description}\n\n"
        f"### NPCs\n{npc_block}\n\n"
        f"### Rules\n{rules_block}\n"
        "- Always respond in-world, in the tone of the setting.\n"
        "- Never break character unless the player explicitly says [OOC].\n"
        "- Guide the story forward; introduce tension, NPCs, and consequences naturally.\n"
        "- Keep responses concise (2–4 paragraphs) unless dramatic scenes call for more.\n"
        "- When the player's message is prefixed with [Action]:, treat it as a narrative action or description.\n"
        "- When the player's message is prefixed with [Dialogue]:, treat it as spoken words from the player character.\n"
    )


def build_interpersonal_system_prompt(scenario: Scenario) -> str:
    rules_block = "\n".join(f"- {r}" for r in scenario.rules) or "None."

    partner_details = f"Name: {scenario.partner_name}\n"
    if scenario.partner_gender:
        partner_details += f"Gender: {scenario.partner_gender}\n"
    if scenario.partner_personality:
        partner_details += f"Personality: {scenario.partner_personality}\n"
    if scenario.partner_body_description:
        partner_details += f"Body: {scenario.partner_body_description}\n"
    if scenario.partner_appearance:
        partner_details += f"Appearance: {scenario.partner_appearance}\n"
    if scenario.partner_likes:
        partner_details += f"Likes: {scenario.partner_likes}\n"
    if scenario.partner_dislikes:
        partner_details += f"Dislikes: {scenario.partner_dislikes}\n"
    if scenario.partner_turn_ons:
        partner_details += f"Turn-ons: {scenario.partner_turn_ons}\n"

    relationship_line = f"\n### Relationship\n{scenario.partner_relationship}\n" if scenario.partner_relationship else ""
    return (
        f"You are roleplaying as {scenario.partner_name} in an interactive two-person story.\n\n"
        f"## Story: {scenario.title}\n\n"
        f"### Setting\n{scenario.setting}\n\n"
        f"### Tone\n{scenario.tone}\n\n"
        f"### Your Character (the one you play)\n"
        f"{partner_details}\n"
        f"### The Other Character (played by the user)\n"
        f"Name: {scenario.character_name}\n"
        f"Description: {scenario.character_description}\n"
        f"{relationship_line}\n"
        f"### Rules\n{rules_block}\n"
        f"- Stay in character as {scenario.partner_name} at all times.\n"
        "- Respond naturally and emotionally, matching the tone of the scene.\n"
        "- Never break character unless the user explicitly says [OOC].\n"
        "- When the user's message is prefixed with [Action]:, treat it as a narrative action.\n"
        "- When the user's message is prefixed with [Dialogue]:, treat it as spoken words.\n"
        "- Keep responses concise (1–3 paragraphs) to maintain conversational flow.\n"
    )


def build_kickoff_prompt(scenario: Scenario) -> str:
    """Hidden user message to trigger the opening narration when no messages exist."""
    if scenario.scenario_type == "interpersonal":
        return (
            f"Set the scene for this encounter. Describe the setting and atmosphere briefly, "
            f"then — as {scenario.partner_name} — initiate the first interaction with "
            f"{scenario.character_name}. Stay in character, matching the tone and your "
            f"character's personality. Keep it natural and conversational."
        )
    return (
        "Begin the story. Set the scene vividly — describe the environment, atmosphere, "
        "sounds, and smells. Introduce the situation the player character finds themselves in "
        "and hint at what lies ahead. Do not speak or act for the player character."
    )


# ---------------------------------------------------------------------------
# Streaming helper
# ---------------------------------------------------------------------------

async def stream_chat(api_messages: list[dict[str, str]]) -> AsyncGenerator[str, None]:
    payload = {
        "model": "local-model",
        "messages": api_messages,
        "stream": True,
    }
    logger.info(">>> LLM stream request (%d messages)", len(api_messages))
    for msg in api_messages:
        preview = msg["content"][:200] + ("…" if len(msg["content"]) > 200 else "")
        logger.info("    [%s] %s", msg["role"], preview)

    collected = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{LLAMA_CPP_URL}/v1/chat/completions",
            json=payload,
        ) as resp:
            async for line in resp.aiter_lines():
                if line.startswith("data: [DONE]"):
                    yield "data: [DONE]\n\n"
                    break
                if line.startswith("data: "):
                    yield line + "\n\n"
                    # Extract token for logging
                    try:
                        chunk = json.loads(line[6:])
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            collected.append(delta)
                    except Exception:
                        pass

    full = "".join(collected)
    logger.info("<<< LLM stream response (%d chars): %s", len(full), full[:300] + ("…" if len(full) > 300 else ""))


# ---------------------------------------------------------------------------
# LLM call helper (non-streaming)
# ---------------------------------------------------------------------------

async def call_llm(messages: list[dict[str, str]], timeout: float = 30.0) -> str:
    payload = {"model": "local-model", "messages": messages}
    logger.info(">>> LLM request (%d messages, timeout=%.0fs)", len(messages), timeout)
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        preview = content[:200] + ("…" if len(content) > 200 else "")
        logger.info("    [%s] %s", role, preview)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(
                f"{LLAMA_CPP_URL}/v1/chat/completions", json=payload,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("<<< LLM HTTP error: %s", exc)
            raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
        except httpx.RequestError as exc:
            logger.error("<<< LLM connection error: %s", exc)
            raise HTTPException(status_code=502, detail=f"Cannot reach llama.cpp: {exc}") from exc
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    logger.info("<<< LLM response (%d chars): %s", len(content), content[:300] + ("…" if len(content) > 300 else ""))
    return content


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(request: ChatRequest):
    logger.info("=== /chat (stream=%s, messages=%d, scenario=%s)", request.stream, len(request.messages), request.scenario.scenario_type if request.scenario else "none")
    api_messages: list[dict[str, str]] = []

    # Prepend system prompt if a scenario is provided
    if request.scenario:
        if request.scenario.scenario_type == "interpersonal":
            system_prompt = build_interpersonal_system_prompt(request.scenario)
        else:
            system_prompt = build_system_prompt(request.scenario)
        api_messages.append({"role": "system", "content": system_prompt})

    # If no user messages yet, inject a hidden kickoff prompt
    if not request.messages and request.scenario:
        api_messages.append({"role": "user", "content": build_kickoff_prompt(request.scenario)})
    else:
        # Format user messages with input-type prefix
        for m in request.messages:
            if m.role == "user" and request.scenario:
                prefix = "[Dialogue]:" if m.input_type == "dialogue" else "[Action]:"
                api_messages.append({"role": m.role, "content": f"{prefix} {m.content}"})
            else:
                api_messages.append({"role": m.role, "content": m.content})

    # Streaming mode
    if request.stream:
        return StreamingResponse(
            stream_chat(api_messages),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Non-streaming mode (legacy)
    payload = {
        "model": "local-model",
        "messages": api_messages,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                f"{LLAMA_CPP_URL}/v1/chat/completions",
                json=payload,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code, detail=str(exc)
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502, detail=f"Cannot reach llama.cpp: {exc}"
            ) from exc

    data = resp.json()
    reply: str = data["choices"][0]["message"]["content"]
    return ChatResponse(reply=reply)


@app.post("/assist", response_model=AssistResponse)
async def assist(request: AssistRequest) -> AssistResponse:
    logger.info("=== /assist (mode=%s, input_type=%s, messages=%d)", request.mode, request.input_type, len(request.messages))
    api_messages: list[dict[str, str]] = []

    # Build context from scenario
    scenario_context = ""
    if request.scenario:
        scenario_context = (
            f"Scenario: {request.scenario.title}\n"
            f"Setting: {request.scenario.setting}\n"
            f"Tone: {request.scenario.tone}\n"
            f"Player character: {request.scenario.character_name} — {request.scenario.character_description}\n"
        )
        if request.scenario.scenario_type == "interpersonal" and request.scenario.partner_name:
            scenario_context += f"Partner character: {request.scenario.partner_name}\n"
            if request.scenario.partner_gender:
                scenario_context += f"Partner gender: {request.scenario.partner_gender}\n"
            if request.scenario.partner_personality:
                scenario_context += f"Partner personality: {request.scenario.partner_personality}\n"
            if request.scenario.partner_relationship:
                scenario_context += f"Relationship: {request.scenario.partner_relationship}\n"

    input_mode = "dialogue (spoken words)" if request.input_type == "dialogue" else "action (narrative description)"

    if request.mode == "suggest":
        system = (
            "You are a creative writing assistant helping a player in an interactive story.\n\n"
            f"{scenario_context}\n"
            f"The player's input mode is: {input_mode}.\n\n"
            "Based on the scenario and conversation so far, suggest what the player character "
            "might say or do next. Output ONLY the suggested text — no quotes, no explanation, "
            "no prefixes. Keep it concise (1–3 sentences)."
        )
    else:
        system = (
            "You are a creative writing assistant.\n\n"
            f"{scenario_context}\n"
            f"The player's input mode is: {input_mode}.\n\n"
            "Rewrite and enhance the following player input to be more vivid, in-character, "
            "and fitting for the scenario. Keep the same intent and meaning. "
            "Output ONLY the rewritten text — no quotes, no explanation, no prefixes."
        )

    api_messages.append({"role": "system", "content": system})

    # Add conversation history for context
    for m in request.messages[-10:]:  # last 10 messages for context
        api_messages.append({"role": m.role, "content": m.content})

    if request.mode == "rewrite":
        api_messages.append({"role": "user", "content": f"Rewrite this: {request.current_text}"})
    else:
        api_messages.append({"role": "user", "content": "Suggest what I should say or do next."})

    text = await call_llm(api_messages, timeout=30.0)
    return AssistResponse(text=text.strip().strip('"').strip("'"))


@app.post("/generate-scenario", response_model=Scenario)
async def generate_scenario(request: GenerateScenarioRequest) -> Scenario:
    logger.info("=== /generate-scenario (type=%s, desc=%s)", request.scenario_type, request.description[:100])
    if request.scenario_type == "interpersonal":
        schema_fields = (
            '{\n'
            '  "scenario_type": "interpersonal",\n'
            '  "title": "string",\n'
            '  "setting": "string (detailed, 2-3 sentences)",\n'
            '  "tone": "string",\n'
            '  "character_name": "string",\n'
            '  "character_description": "string (detailed, 1-2 sentences)",\n'
            '  "partner_name": "string",\n'
            '  "partner_gender": "string, e.g. Male / Female / Non-binary",\n'
            '  "partner_personality": "string (detailed personality traits, 1-2 sentences, e.g. Shy but fiercely loyal, with a dry sense of humor)",\n'
            '  "partner_body_description": "string (physical build, height, distinguishing features, 1-2 sentences)",\n'
            '  "partner_appearance": "string (hair color, eye color, clothing style, overall look, 1-2 sentences)",\n'
            '  "partner_relationship": "string (relationship to the user character, e.g. College roommate, Coworker)",\n'
            '  "partner_likes": "string (hobbies, interests, things they enjoy, comma-separated)",\n'
            '  "partner_dislikes": "string (pet peeves, things they avoid, comma-separated)",\n'
            '  "partner_turn_ons": "string (what attracts or excites them, comma-separated)",\n'
            '  "npcs": [],\n'
            '  "rules": ["string", ...]\n'
            '}'
        )
        extra_instructions = (
            "IMPORTANT: For interpersonal scenarios you MUST fill in ALL partner fields with creative, "
            "detailed content. Do NOT leave partner_gender, partner_personality, partner_body_description, "
            "partner_appearance, partner_relationship, partner_likes, partner_dislikes, or partner_turn_ons "
            "as empty strings. Each field must have meaningful content."
        )
    else:
        schema_fields = (
            '{\n'
            '  "scenario_type": "adventure",\n'
            '  "title": "string",\n'
            '  "setting": "string (detailed)",\n'
            '  "tone": "string",\n'
            '  "character_name": "string",\n'
            '  "character_description": "string (detailed)",\n'
            '  "npcs": [{"name": "string", "description": "string", "mode": "simple"}, ...],\n'
            '  "partner_name": "",\n'
            '  "partner_gender": "",\n'
            '  "partner_personality": "",\n'
            '  "partner_body_description": "",\n'
            '  "partner_appearance": "",\n'
            '  "partner_relationship": "",\n'
            '  "partner_likes": "",\n'
            '  "partner_dislikes": "",\n'
            '  "partner_turn_ons": "",\n'
            '  "rules": ["string", ...]\n'
            '}'
        )
        extra_instructions = ""

    system = (
        "You are a creative scenario designer for interactive stories.\n"
        "Generate a complete, detailed scenario based on the user's description.\n"
        "Output ONLY valid JSON matching this exact schema — no markdown, no explanation:\n\n"
        f"{schema_fields}\n\n"
        "Make the setting vivid (2-3 sentences), character descriptions detailed (1-2 sentences each), "
        "and include 2-4 rules. For adventure scenarios include 2-3 NPCs."
    )
    if extra_instructions:
        system += f"\n\n{extra_instructions}"

    api_messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": request.description},
    ]

    raw = await call_llm(api_messages, timeout=60.0)

    # Try to extract JSON from the response
    try:
        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        scenario = Scenario.model_validate_json(cleaned)
    except Exception:
        # Retry: ask LLM to fix the JSON
        fix_messages = [
            {"role": "system", "content": "Fix the following to be valid JSON matching the schema. Output ONLY the corrected JSON."},
            {"role": "user", "content": raw},
        ]
        raw2 = await call_llm(fix_messages, timeout=30.0)
        cleaned2 = raw2.strip()
        if cleaned2.startswith("```"):
            cleaned2 = cleaned2.split("\n", 1)[1] if "\n" in cleaned2 else cleaned2[3:]
            if cleaned2.endswith("```"):
                cleaned2 = cleaned2[:-3]
            cleaned2 = cleaned2.strip()
        scenario = Scenario.model_validate_json(cleaned2)

    return scenario


@app.post("/generate-npc")
async def generate_npc(request: GenerateNpcRequest) -> dict:
    logger.info("=== /generate-npc (name=%s, desc=%s, setting=%s)", request.npc_name or "(empty)", request.npc_description[:80] if request.npc_description else "(empty)", request.setting[:80] if request.setting else "(empty)")
    context_parts = []
    if request.title:
        context_parts.append(f"Story: {request.title}")
    if request.setting:
        context_parts.append(f"Setting: {request.setting}")
    if request.tone:
        context_parts.append(f"Tone: {request.tone}")
    context = "\n".join(context_parts)

    npc_info = ""
    if request.npc_name:
        npc_info += f"NPC Name: {request.npc_name}\n"
    if request.npc_description:
        npc_info += f"NPC Description: {request.npc_description}\n"

    if not npc_info:
        npc_info = "No name or description provided — invent an NPC that fits the setting.\n"

    system = (
        "You are an expert D&D 2024 NPC designer.\n"
        + (f"{context}\n\n" if context else "")
        + f"{npc_info}\n"
        "Generate a detailed D&D 2024 NPC. Output ONLY valid JSON with this exact schema:\n\n"
        '{\n'
        '  "name": "string (use provided name or invent one)",\n'
        '  "race": "string (D&D 2024 species, e.g. Human, Elf, Dwarf, Tiefling)",\n'
        '  "description": "string (physical appearance, 1-2 sentences)",\n'
        '  "personality": "string (personality traits, ideals, bonds, flaws — 1-2 sentences)",\n'
        '  "alignment": "string (e.g. Lawful Good, Chaotic Neutral, True Neutral)",\n'
        '  "cr": "string (Challenge Rating, e.g. 1/8, 1/4, 1/2, 1, 3, 5)",\n'
        '  "classes": [{"name": "string (D&D 2024 class name)", "level": <1-20>}],\n'
        '  "stats": {"str": <1-20>, "dex": <1-20>, "con": <1-20>, "int": <1-20>, "wis": <1-20>, "cha": <1-20>},\n'
        '  "saving_throws": ["STR", "DEX", ...],\n'
        '  "skills": ["Perception", "Stealth", ...],\n'
        '  "equipment": ["item name", ...],\n'
        '  "actions": [{"name": "string", "description": "string (dice, range, effects)"}],\n'
        '  "foes": ["string", ...],\n'
        '  "friends": ["string", ...],\n'
        '  "plot_twists": ["string", ...]\n'
        '}\n\n'
        "D&D 2024 guidelines:\n"
        "- classes: list one or more classes with level (multiclassing allowed). Match stats to classes (Fighter→STR/CON, Wizard→INT, Cleric→WIS, Rogue→DEX, etc.).\n"
        "- saving_throws: 2 proficient saves matching the primary class (Fighter: STR+CON, Wizard: INT+WIS, Rogue: DEX+INT, Cleric: WIS+CHA, etc.).\n"
        "- skills: 3-5 skills appropriate to the class and background.\n"
        "- equipment: 3-6 items appropriate to class and CR (weapons, armour, tools, magic items).\n"
        "- actions: 2-4 actions. For martial classes include attack(s) with +to-hit, damage dice, and damage type. For spellcasters include 1-2 representative spells with spell save DC or attack bonus.\n"
        "- cr and stats should be consistent with total class levels.\n"
        "Include 1-3 foes, 1-3 friends, and 1-2 plot twists. ALL fields must be filled."
    )

    api_messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": "Generate this NPC's full D&D 2024 profile."},
    ]

    raw = await call_llm(api_messages, timeout=120.0)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        return json.loads(cleaned)
    except Exception:
        fix_messages = [
            {"role": "system", "content": "Fix the following to be valid JSON. Output ONLY the corrected JSON."},
            {"role": "user", "content": raw},
        ]
        raw2 = await call_llm(fix_messages, timeout=30.0)
        cleaned2 = raw2.strip()
        if cleaned2.startswith("```"):
            cleaned2 = cleaned2.split("\n", 1)[1] if "\n" in cleaned2 else cleaned2[3:]
            if cleaned2.endswith("```"):
                cleaned2 = cleaned2[:-3]
            cleaned2 = cleaned2.strip()
        return json.loads(cleaned2)


@app.post("/generate-quest")
async def generate_quest(request: GenerateQuestRequest) -> dict:
    logger.info("=== /generate-quest (prompt=%s, setting=%s, party_level=%s)", request.prompt[:80], request.setting[:60] if request.setting else "(empty)", request.party_level)
    context_parts = []
    if request.setting:
        context_parts.append(f"Setting: {request.setting}")
    if request.tone:
        context_parts.append(f"Tone: {request.tone}")
    if request.party_level is not None:
        context_parts.append(f"Party Level: {request.party_level} (scale encounter difficulty, rewards, and challenge appropriately for a level {request.party_level} DnD party)")
    context = "\n".join(context_parts)

    system = (
        "You are an expert Dungeon Master and quest designer following D&D 2024 rules.\n"
        + (f"{context}\n\n" if context else "")
        + "Generate a detailed quest based on the user's prompt. Output ONLY valid JSON with this exact schema:\n\n"
        '{\n'
        '  "title": "string",\n'
        '  "description": "string (2-3 sentences, engaging hook)",\n'
        '  "objectives": ["string", ...],\n'
        '  "rewards": {\n'
        '    "gold": <integer gp amount, scaled to party level>,\n'
        '    "silver": <integer sp amount>,\n'
        '    "items": ["string (item name, e.g. Potion of Healing, +1 Longsword)", ...]\n'
        '  },\n'
        '  "encounters": [\n'
        '    {\n'
        '      "description": "string (encounter setup/context)",\n'
        '      "monsters": [\n'
        '        {"name": "string (official D&D 2024 monster name)", "cr": "string (e.g. 1/4, 1/2, 1, 5, 11)"}\n'
        '      ]\n'
        '    }\n'
        '  ],\n'
        '  "difficulty": "Easy | Medium | Hard | Deadly",\n'
        '  "setting": "string (where the quest takes place)",\n'
        '  "estimated_duration": "string (e.g. 2-3 hours, one session, multi-session)",\n'
        '  "party_level": <number or null>,\n'
        '  "xp_budget": <total XP budget for all encounters combined, integer, based on D&D 2024 encounter building rules, or null>\n'
        '}\n\n'
        "D&D 2024 guidelines:\n"
        "- Include 2-4 objectives, 2-4 encounters with 1-5 monsters each.\n"
        "- Choose monster CRs appropriate for the party level (CR roughly = party level ± 3 for medium difficulty).\n"
        "- Scale gold rewards: ~50gp × party_level for a medium quest; adjust up for hard/deadly.\n"
        "- Include 1-3 magic items appropriate for the party level.\n"
        "- Calculate xp_budget using D&D 2024 encounter XP thresholds (Easy=50×lvl, Medium=75×lvl, Hard=100×lvl, Deadly=150×lvl per character, assume 4 characters).\n"
        "- ALL fields must have meaningful content."
    )

    api_messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": request.prompt},
    ]

    raw = await call_llm(api_messages, timeout=180.0)

    def _strip_fences(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
        return text.strip()

    try:
        return json.loads(_strip_fences(raw))
    except Exception:
        fix_messages = [
            {"role": "system", "content": "Fix the following to be valid JSON. Output ONLY the corrected JSON."},
            {"role": "user", "content": raw},
        ]
        raw2 = await call_llm(fix_messages, timeout=60.0)
        return json.loads(_strip_fences(raw2))


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
