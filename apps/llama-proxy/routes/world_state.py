import json

from fastapi import APIRouter
from pydantic import BaseModel

import config
from json_utils import _extract_json_object
from llm import call_llm
from models import (
    Scenario,
    StoryMessage,
    WorldStateDelta,
    WorldStateModel,
    WorldStateUpdateRequest,
)


# Phase 3a: World tick request model
class WorldTickRequest(BaseModel):
    scenario: Scenario
    world_state: WorldStateModel

router = APIRouter(tags=["world-state"])


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
5. clock_advance: set to {{"turns": N}} when the narrative implies a rest, journey, or time-skip (N = number of time-of-day periods to advance). Omit (null) if no time passes.
6. key_facts_append: only for major permanent facts. Max 2 per turn.
7. Use ONLY the IDs from the tables above. If an entity has no listed ID, omit it.
8. If NOTHING changed, return all empty arrays/null — do not invent changes.

Output ONLY valid JSON matching this schema:
{{
  "faction_changes": [{{"faction_id": "str", "standing_delta": 0, "notes_append": ""}}],
  "npc_changes": [{{"npc_id": "str", "new_status": null, "disposition_delta": 0, "new_known_facts": [], "notes_append": ""}}],
  "new_events": [{{"title": "str", "description": "str", "type": "world", "certainty": "witnessed", "source": "", "involved_npc_ids": [], "involved_faction_ids": [], "location_id": null}}],
  "scene_update": null,
  "clock_advance": null,
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


class SessionSummaryRequest(BaseModel):
    scenario: Scenario
    world_state: WorldStateModel
    last_messages: list[StoryMessage]


@router.post("/world-state/summary")
async def generate_session_summary(request: SessionSummaryRequest) -> dict:
    config.logger.info(
        "=== /world-state/summary (turn=%d, messages=%d)",
        request.world_state.turn_count,
        len(request.last_messages),
    )
    messages_text = "\n".join(
        f"[{m.role.upper()}]: {m.content[:200]}" for m in request.last_messages[-20:]
    )
    turn_start = max(0, request.world_state.turn_count - 20)
    prompt = f"""Summarize this RPG session in 3-5 sentences and extract 3-5 key facts.
Return JSON: {{"summary": "...", "keyFacts": ["...", "..."]}}

Scenario: {request.world_state.scenario_title}
Turn range: {turn_start} to {request.world_state.turn_count}

Recent exchanges:
{messages_text}
"""
    api_messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the session summary JSON now."},
    ]

    raw = ""
    try:
        raw = await call_llm(api_messages, timeout=30.0, json_mode=True, temperature=0.15)
        result = json.loads(_extract_json_object(raw))
        return result
    except Exception as exc:
        config.logger.error(
            "world-state/summary parse error: %s | raw: %s", exc, raw[:300] or "N/A"
        )
        return {"summary": "", "keyFacts": []}


@router.post("/world-state/tick")
async def world_tick(request: WorldTickRequest) -> WorldStateDelta:
    """Phase 3a: Heartbeat tick — generate ambient inject, NPC rumors, faction drift between turns."""
    config.logger.info(
        "=== /world-state/tick (npcs=%d, factions=%d, turn=%d)",
        len(request.world_state.npc_states),
        len(request.world_state.factions),
        request.world_state.turn_count,
    )

    npc_summary = "\n".join(
        f"- {n.name} (disposition {n.disposition}, status {n.status})"
        for n in request.world_state.npc_states[:8]
    )
    faction_summary = "\n".join(
        f"- {f.name} (standing {f.standing})"
        for f in request.world_state.factions[:4]
    )

    location = "Unknown"
    if request.world_state.current_scene and request.world_state.current_scene.location_id:
        loc = next(
            (loc_ for loc_ in request.world_state.locations if loc_.id == request.world_state.current_scene.location_id),
            None,
        )
        if loc:
            location = loc.name

    season = request.world_state.world_clock.season
    time_of_day = request.world_state.world_clock.time_of_day
    tension = request.world_state.current_scene.tension if request.world_state.current_scene else "calm"

    prompt = f"""Update this living RPG world between player turns. Return a JSON WorldStateDelta.

Scenario: {request.world_state.scenario_title}
Location: {location} | Time: {time_of_day} ({season}) | Tension: {tension}

NPCs:
{npc_summary if npc_summary else "None"}

Factions:
{faction_summary if faction_summary else "None"}

Rules:
- ambient_inject: one atmospheric sentence specific to location/time/season/tension. Make it evocative.
- npc_rumors: 0 or 1 rumored StoryEvent. Only if an NPC with |disposition| >= 40 would plausibly have acted off-screen. certainty must be "rumored".
- faction_drift: for each faction where |standing| > 0, drift 2 points toward 0 (passive neutralization). standing_delta = -2 if positive, +2 if negative.
- All other delta fields: empty/null.

Return only valid JSON matching this schema:
{{
  "faction_changes": [],
  "npc_changes": [],
  "new_events": [],
  "scene_update": null,
  "clock_advance": null,
  "key_facts_append": [],
  "quest_updates": [],
  "player_update": null,
  "story_beat_update": null,
  "ambient_inject": "...",
  "npc_rumors": [],
  "faction_drift": [{{"faction_id": "str", "standing_delta": 0, "notes_append": ""}}],
  "bond_update": null
}}"""

    api_messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the world tick JSON now."},
    ]

    raw = ""
    try:
        raw = await call_llm(api_messages, timeout=30.0, json_mode=True, temperature=0.3)
        delta_raw = json.loads(_extract_json_object(raw))
        return WorldStateDelta(**delta_raw)
    except Exception as exc:
        config.logger.error(
            "world-state/tick parse error: %s | raw: %s", exc, raw[:300] or "N/A"
        )
        return WorldStateDelta()
