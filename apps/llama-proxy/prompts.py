from __future__ import annotations

from typing import TYPE_CHECKING

from models import Scenario

if TYPE_CHECKING:
    from models import WorldStateModel


def standing_label(v: int) -> str:
    if v >= 75:
        return "allied"
    if v >= 40:
        return "friendly"
    if v >= 10:
        return "neutral-positive"
    if v >= -10:
        return "neutral"
    if v >= -40:
        return "unfriendly"
    if v >= -75:
        return "hostile"
    return "enemy"


def _build_world_state_block(world_state: WorldStateModel) -> str:
    parts: list[str] = [
        "\n### WORLD STATE (AUTHORITATIVE — DO NOT CONTRADICT)",
        "The following reflects what has actually happened in this story.",
        "These are established facts. Do not invent events, resurrect dead characters,",
        "or contradict established relationships. If unsure, stay silent on the detail.",
    ]

    # Current scene
    if world_state.current_scene:
        sc = world_state.current_scene
        loc_name = sc.location_id or "Unknown location"
        for loc in world_state.locations:
            if loc.id == sc.location_id:
                loc_name = loc.name
                break
        present_names = []
        for npc_id in sc.present_npc_ids:
            for n in world_state.npc_states:
                if n.npc_id == npc_id:
                    present_names.append(n.name)
                    break
        wc = world_state.world_clock
        parts.append(
            f"\n**Current scene:** {loc_name} — {sc.tension} — {sc.scene_note}"
        )
        if present_names:
            parts.append(f"Present: {', '.join(present_names)}")
        parts.append(f"Time: Day {wc.day_number}, {wc.time_of_day} ({wc.season})")

    # Active NPCs (alive only)
    scene_ids = set(world_state.current_scene.present_npc_ids) if world_state.current_scene else set()
    alive_npcs = [n for n in world_state.npc_states if n.status != "dead"]
    dead_npcs = [n for n in world_state.npc_states if n.status == "dead"]

    if alive_npcs:
        parts.append("\n#### Active NPCs")
        # Scene NPCs first
        for n in sorted(alive_npcs, key=lambda x: x.npc_id not in scene_ids):
            label = standing_label(n.disposition)
            line = f"- {n.name} ({label} toward player)"
            if n.notes:
                line += f": {n.notes[:80]}"
            parts.append(line)
            for rel in n.relationships:
                if rel.disposition != 0:
                    for other in world_state.npc_states:
                        if other.npc_id == rel.target_npc_id:
                            rel_label = standing_label(rel.disposition)
                            parts.append(f"  → {rel_label} toward {other.name}: {rel.note}")
                            break

    # Factions (non-zero standing only)
    non_neutral_factions = [f for f in world_state.factions if f.standing != 0]
    if non_neutral_factions:
        parts.append("\n#### Factions")
        for f in non_neutral_factions:
            label = standing_label(f.standing)
            sign = "+" if f.standing > 0 else ""
            arch = f" [{', '.join(f.archetypes)}]" if f.archetypes else ""
            parts.append(f"- {f.name} ({label}, {sign}{f.standing}): {f.description[:100]}{arch}")

    # Recent events (last 3, skip 'false' certainty)
    visible_events = [e for e in world_state.story_events if e.certainty != "false"][-3:]
    if visible_events:
        parts.append("\n#### Recent Events")
        for e in visible_events:
            if e.certainty == "rumored":
                prefix = "Reportedly: "
            elif e.certainty == "deduced":
                prefix = "Evidence suggests: "
            else:
                prefix = ""
            parts.append(f"- Turn {e.turn} — {e.title}: {prefix}{e.description[:120]}")

    # Canon facts
    if world_state.key_facts:
        parts.append("\n#### Canon Facts")
        for fact in world_state.key_facts:
            parts.append(f"- {fact}")

    # Deceased / Absent
    if dead_npcs:
        parts.append("\n#### Deceased / Absent (do not include in scenes or dialogue)")
        for n in dead_npcs:
            parts.append(f"- {n.name} (DEAD{': ' + n.notes if n.notes else ''})")

    return "\n".join(parts)


def build_system_prompt(scenario: Scenario, world_state: WorldStateModel | None = None) -> str:
    npc_lines = []
    for n in scenario.npcs:
        line = f"- {n.name}: {n.description}"
        if n.mode == "detailed":
            if n.personality:
                line += f" | Personality: {n.personality}"
            if n.stats:
                stat_parts = []
                for attr, label in (
                    ("str_val", "STR"),
                    ("dex", "DEX"),
                    ("con", "CON"),
                    ("int_val", "INT"),
                    ("wis", "WIS"),
                    ("cha", "CHA"),
                ):
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
    world_state_block = _build_world_state_block(world_state) if world_state else ""
    return (
        "You are the storyteller and game master of an interactive story.\n\n"
        f"## Story: {scenario.title}\n\n"
        f"### Setting\n{scenario.setting}\n\n"
        f"### Tone\n{scenario.tone}\n\n"
        "### Player Character\n"
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
        "- When the player's message is prefixed with [Direct]:, treat it as a director's instruction — steer the story in that direction without the player character speaking or acting. Acknowledge the direction naturally through the narrative.\n"
        f"{world_state_block}"
    )


def build_interpersonal_system_prompt(scenario: Scenario, world_state: WorldStateModel | None = None) -> str:
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

    relationship_line = (
        f"\n### Relationship\n{scenario.partner_relationship}\n" if scenario.partner_relationship else ""
    )
    world_state_block = _build_world_state_block(world_state) if world_state else ""
    return (
        f"You are roleplaying as {scenario.partner_name} in an interactive two-person story.\n\n"
        f"## Story: {scenario.title}\n\n"
        f"### Setting\n{scenario.setting}\n\n"
        f"### Tone\n{scenario.tone}\n\n"
        "### Your Character (the one you play)\n"
        f"{partner_details}\n"
        "### The Other Character (played by the user)\n"
        f"Name: {scenario.character_name}\n"
        f"Description: {scenario.character_description}\n"
        f"{relationship_line}\n"
        f"### Rules\n{rules_block}\n"
        f"- Stay in character as {scenario.partner_name} at all times.\n"
        "- Respond naturally and emotionally, matching the tone of the scene.\n"
        "- Never break character unless the user explicitly says [OOC].\n"
        "- When the user's message is prefixed with [Action]:, treat it as a narrative action.\n"
        "- When the user's message is prefixed with [Dialogue]:, treat it as spoken words.\n"
        "- When the user's message is prefixed with [Direct]:, treat it as a director's instruction about where the scene should go — respond accordingly through your character's behaviour and words without breaking immersion.\n"
        "- Keep responses concise (1–3 paragraphs) to maintain conversational flow.\n"
        f"{world_state_block}"
    )


def build_kickoff_prompt(scenario: Scenario) -> str:
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
