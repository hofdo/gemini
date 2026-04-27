import json

from fastapi import APIRouter
from pydantic import BaseModel

import config
from json_utils import _extract_json_object
from llm import call_llm
from models import Scenario, WorldStateModel


class CombatParticipantPayload(BaseModel):
    entity_id: str
    name: str
    initiative: int = 0
    hp: dict = {"current": 10, "max": 10}
    is_player: bool = False


class CombatStatePayload(BaseModel):
    active: bool = False
    round: int = 1
    initiative_order: list[CombatParticipantPayload] = []
    active_entity_index: int = 0
    log: list[str] = []


class CombatResolveRequest(BaseModel):
    scenario: Scenario
    world_state: WorldStateModel
    combat_state: CombatStatePayload
    action_text: str
    active_entity_id: str
    dice_roll: int = 10


class CombatResolution(BaseModel):
    narrative: str
    hp_changes: list[dict] = []
    status_changes: list[dict] = []
    round_end: bool = False


router = APIRouter(tags=["combat"])


@router.post("/combat/resolve-turn")
async def resolve_combat_turn(request: CombatResolveRequest) -> CombatResolution:
    config.logger.info(
        "=== /combat/resolve-turn (round=%d, action=%s)",
        request.combat_state.round,
        request.action_text[:60],
    )

    initiative_lines = "\n".join(
        f"  {'* ' if p.entity_id == request.active_entity_id else '  '}"
        f"{p.name} — HP {p.hp.get('current', '?')}/{p.hp.get('max', '?')}"
        for p in request.combat_state.initiative_order
    )

    active_name = next(
        (p.name for p in request.combat_state.initiative_order if p.entity_id == request.active_entity_id),
        request.active_entity_id,
    )
    total_entities = len(request.combat_state.initiative_order)

    system_prompt = f"""You are a combat resolver for an interactive RPG.
Resolve one combat turn and return a JSON object.

Scenario: {request.scenario.title} | Tone: {request.scenario.tone}

Combat State — Round {request.combat_state.round}:
Initiative order (* = acting now):
{initiative_lines if initiative_lines else "  (no participants)"}

Active entity: {active_name} (id: {request.active_entity_id})
Action: {request.action_text}
Dice roll: {request.dice_roll} (1=fumble, 10=average, 20=critical)

Rules:
1. narrative: 1-3 sentences describing the outcome vividly, matching the scenario tone.
2. hp_changes: list of {{"entityId": "str", "hpDelta": N}} — hpDelta is NEGATIVE for damage, POSITIVE for healing. Omit entries with no change.
3. status_changes: ONLY add {{"entityId": "str", "newStatus": "dead"}} when an entity's HP would reach 0 or below after this action. Otherwise omit.
4. round_end: set true when all {total_entities} entities have taken a turn this round, false otherwise.

Output ONLY valid JSON matching this schema:
{{
  "narrative": "...",
  "hp_changes": [{{"entityId": "str", "hpDelta": -5}}],
  "status_changes": [{{"entityId": "str", "newStatus": "dead"}}],
  "round_end": false
}}"""

    api_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Resolve this combat turn and return the JSON now."},
    ]

    raw = ""
    try:
        raw = await call_llm(api_messages, timeout=30.0, json_mode=True, temperature=0.1)
        result = json.loads(_extract_json_object(raw))
        return CombatResolution(**result)
    except Exception as exc:
        config.logger.error(
            "combat/resolve-turn parse error: %s | raw: %s", exc, raw[:300] or "N/A"
        )
        return CombatResolution(narrative="The action resolves.", round_end=False)
