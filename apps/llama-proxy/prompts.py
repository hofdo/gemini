from models import Scenario


def build_system_prompt(scenario: Scenario) -> str:
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

    relationship_line = (
        f"\n### Relationship\n{scenario.partner_relationship}\n" if scenario.partner_relationship else ""
    )
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
