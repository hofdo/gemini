import json

from fastapi import APIRouter, HTTPException

import config
from json_utils import _extract_json_object, _fix_retry_messages, _parse_with_repair
from llm import call_llm
from models import (
    AssistRequest,
    AssistResponse,
    GenerateNpcRequest,
    GenerateQuestRequest,
    GenerateScenarioRequest,
    Scenario,
    WorldStateDelta,
    WorldStateUpdateRequest,
)

router = APIRouter()


@router.post("/assist", response_model=AssistResponse)
async def assist(request: AssistRequest) -> AssistResponse:
    config.logger.info(
        "=== /assist (mode=%s, input_type=%s, messages=%d)",
        request.mode,
        request.input_type,
        len(request.messages),
    )
    api_messages: list[dict[str, str]] = []

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

    input_mode = (
        "dialogue (spoken words)"
        if request.input_type == "dialogue"
        else "action (narrative action/description)"
        if request.input_type == "action"
        else "direct (director instruction — steer where the story goes next)"
    )

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
    for m in request.messages[-10:]:
        api_messages.append({"role": m.role, "content": m.content})

    if request.mode == "rewrite":
        api_messages.append({"role": "user", "content": f"Rewrite this: {request.current_text}"})
    else:
        api_messages.append({"role": "user", "content": "Suggest what I should say or do next."})

    text = await call_llm(api_messages, timeout=30.0)
    return AssistResponse(text=text.strip().strip('"').strip("'"))


@router.post("/generate-scenario", response_model=Scenario)
async def generate_scenario(request: GenerateScenarioRequest) -> Scenario:
    config.logger.info(
        "=== /generate-scenario (type=%s, desc=%s)", request.scenario_type, request.description[:100]
    )
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

    raw = await call_llm(api_messages, timeout=60.0, json_mode=True)

    try:
        return Scenario.model_validate_json(_extract_json_object(raw))
    except Exception:
        pass

    try:
        return Scenario.model_validate(_parse_with_repair(raw))
    except Exception:
        config.logger.warning("/generate-scenario: direct + repair failed, retrying with LLM")

    raw2 = await call_llm(
        _fix_retry_messages(raw, schema_hint=schema_fields), timeout=45.0, json_mode=True
    )
    try:
        return Scenario.model_validate_json(_extract_json_object(raw2))
    except Exception as exc:
        config.logger.error(
            "/generate-scenario: all attempts failed. raw=%r raw2=%r err=%s",
            raw[:200],
            raw2[:200],
            exc,
        )
        raise HTTPException(
            status_code=422,
            detail="The LLM did not return valid scenario JSON after two attempts. Try again.",
        ) from exc


@router.post("/generate-npc")
async def generate_npc(request: GenerateNpcRequest) -> dict:
    config.logger.info(
        "=== /generate-npc (name=%s, desc=%s, setting=%s)",
        request.npc_name or "(empty)",
        request.npc_description[:80] if request.npc_description else "(empty)",
        request.setting[:80] if request.setting else "(empty)",
    )
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

    raw = await call_llm(api_messages, timeout=120.0, json_mode=True)

    try:
        return json.loads(_extract_json_object(raw))
    except Exception:
        pass

    try:
        return _parse_with_repair(raw)
    except Exception:
        config.logger.warning("/generate-npc: direct + repair failed, retrying with LLM")

    raw2 = await call_llm(_fix_retry_messages(raw), timeout=45.0, json_mode=True)
    try:
        return json.loads(_extract_json_object(raw2))
    except Exception as exc:
        config.logger.error(
            "/generate-npc: all attempts failed. raw=%r raw2=%r err=%s", raw[:200], raw2[:200], exc
        )
        raise HTTPException(
            status_code=422,
            detail="The LLM did not return valid NPC JSON after two attempts. Try again.",
        ) from exc


@router.post("/generate-quest")
async def generate_quest(request: GenerateQuestRequest) -> dict:
    config.logger.info(
        "=== /generate-quest (prompt=%s, setting=%s, party_level=%s)",
        request.prompt[:80],
        request.setting[:60] if request.setting else "(empty)",
        request.party_level,
    )
    context_parts = []
    if request.setting:
        context_parts.append(f"Setting: {request.setting}")
    if request.tone:
        context_parts.append(f"Tone: {request.tone}")
    if request.party_level is not None:
        context_parts.append(
            f"Party Level: {request.party_level} (scale encounter difficulty, rewards, and challenge "
            f"appropriately for a level {request.party_level} DnD party)"
        )
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

    raw = await call_llm(api_messages, timeout=180.0, json_mode=True)

    try:
        return json.loads(_extract_json_object(raw))
    except Exception:
        pass

    try:
        return _parse_with_repair(raw)
    except Exception:
        config.logger.warning("/generate-quest: direct + repair failed, retrying with LLM")

    raw2 = await call_llm(_fix_retry_messages(raw), timeout=60.0, json_mode=True)
    try:
        return json.loads(_extract_json_object(raw2))
    except Exception as exc:
        config.logger.error(
            "/generate-quest: all attempts failed. raw=%r raw2=%r err=%s", raw[:200], raw2[:200], exc
        )
        raise HTTPException(
            status_code=422,
            detail="The LLM did not return valid quest JSON after two attempts. Try again.",
        ) from exc


@router.post("/world-state/update")
async def update_world_state(request: WorldStateUpdateRequest) -> WorldStateDelta:
    config.logger.info(
        "=== /world-state/update (npcs=%d, factions=%d, exchanges=%d)",
        len(request.world_state.npc_states),
        len(request.world_state.factions),
        len(request.last_exchanges),
    )

    npc_table = "\n".join(
        f'- "{n.npc_id}": {n.name}' for n in request.world_state.npc_states
    )
    faction_table = "\n".join(
        f'- "{f.id}": {f.name}' for f in request.world_state.factions
    )

    system_prompt = f"""You are the world state tracker for an interactive story.
Analyze the story exchange and extract ONLY what actually changed.

Available NPC IDs (use these exactly):
{npc_table if npc_table else "(none yet)"}

Available faction IDs (use these exactly):
{faction_table if faction_table else "(none yet)"}

Rules:
1. Only mark NPC status "dead" if the narrative EXPLICITLY states death — not "might be dead", "fled", "disappeared".
2. Disposition changes: only when the narrative shows a clear positive/negative interaction. Cap at +/-25 per turn.
3. New events: only for distinct actions, discoveries, or confrontations — not ambient description. Title 6 words max. Set certainty="witnessed" if the player character was present.
4. Scene update: change location_id if the player moved. Add/remove NPC IDs as they enter/leave. Update tension to "hostile" or "combat" only when appropriate.
5. clock_advance: true only when the narrative implies a rest, journey, or time-skip.
6. key_facts_append: only for major permanent facts. Max 2 per turn.
7. Use ONLY the IDs from the tables above. If an entity has no listed ID, omit it.
8. If NOTHING changed, return all empty arrays/null — do not invent changes.

Output ONLY valid JSON matching this schema:
{{
  "faction_changes": [{{"faction_id": "str", "standing_delta": 0, "notes_append": ""}}],
  "npc_changes": [{{"npc_id": "str", "new_status": null, "disposition_delta": 0, "new_known_facts": [], "notes_append": ""}}],
  "new_events": [{{"title": "str", "description": "str", "type": "world", "certainty": "witnessed", "source": "", "involved_npc_ids": [], "involved_faction_ids": [], "location_id": null}}],
  "scene_update": null,
  "clock_advance": false,
  "key_facts_append": []
}}"""

    api_messages = [
        {"role": "system", "content": system_prompt},
    ] + [
        {"role": m.role, "content": m.content}
        for m in request.last_exchanges
    ]

    raw = ""
    try:
        raw = await call_llm(api_messages, timeout=30.0, json_mode=True, temperature=0.15)
        delta_raw = json.loads(_extract_json_object(raw))
        return WorldStateDelta(**delta_raw)
    except Exception as exc:
        config.logger.error(
            "world-state/update parse error: %s | raw: %s", exc, raw[:300] or "N/A"
        )
        # Return empty delta on parse failure — non-blocking for the user
        return WorldStateDelta()
