from fastapi import APIRouter
from fastapi.responses import StreamingResponse

import config
from llm import call_llm, stream_chat
from models import ChatRequest, ChatResponse
from prompts import build_interpersonal_system_prompt, build_kickoff_prompt, build_system_prompt

router = APIRouter()

# Phase 3b: Story beat hints
STORY_BEAT_HINTS = {
    "inciting_incident": "The story is just beginning. Something has changed. Build anticipation.",
    "rising_tension": "Tensions escalate. Consequences feel closer. Narrate with urgency.",
    "dark_moment": "The protagonist is in genuine danger or moral crisis. Do not soften this.",
    "climax_pending": "Multiple threads are converging. The story approaches its peak.",
    "resolution": "Major conflicts resolved. The world breathes again. Reflect consequences.",
}

# Phase 3c: Tone fragments
TONE_FRAGMENTS = {
    "pacing": {
        "cinematic": "Write shorter paragraphs. Cut to scene transitions quickly. Favor action over description.",
        "deliberate": "",
    },
    "register": {
        "gritty": "Consequences feel heavy. Wounds matter. Dialogue is terse and real.",
        "balanced": "",
        "mythic": "Events feel fated. Language is elevated. The world is beautiful and terrible in equal measure.",
    },
    "boundary": {
        "fade": "Fade to black for violence and explicit content. Imply consequences, do not depict them.",
        "standard": "",
        "unfiltered": "Narrate without omission. Do not soften or fade.",
    },
}

# Phase 3d: Bond tier names
TIER_NAMES = ["stranger", "acquaintance", "confidant", "close", "intimate", "bonded"]


def build_tone_fragment(tone) -> str:
    parts = [
        TONE_FRAGMENTS["pacing"].get(tone.pacing, ""),
        TONE_FRAGMENTS["register"].get(tone.register, ""),
        TONE_FRAGMENTS["boundary"].get(tone.boundary, ""),
    ]
    return "\n".join(p for p in parts if p)


@router.post("/chat")
async def chat(request: ChatRequest):
    config.logger.info(
        "=== /chat (stream=%s, messages=%d, scenario=%s)",
        request.stream,
        len(request.messages),
        request.scenario.scenario_type if request.scenario else "none",
    )
    api_messages: list[dict[str, str]] = []

    if request.scenario:
        if request.scenario.scenario_type == "interpersonal":
            system_prompt = build_interpersonal_system_prompt(request.scenario, request.world_state)
        else:
            system_prompt = build_system_prompt(request.scenario, request.world_state)

        # Phase 3b: Story beat hint
        if request.world_state and request.world_state.story_beat:
            hint = STORY_BEAT_HINTS.get(request.world_state.story_beat, "")
            if hint:
                system_prompt += f"\n[Narrative beat: {hint}]"

        # Phase 3c: Tone fragment
        tone_fragment = build_tone_fragment(request.tone_settings)
        if tone_fragment:
            system_prompt += f"\n\n[Narrative style guidance:\n{tone_fragment}]"

        # Phase 3d: Bond context for interpersonal scenarios
        if (request.scenario.scenario_type == "interpersonal"
                and request.world_state and request.world_state.bond_state):
            bs = request.world_state.bond_state
            tier_name = TIER_NAMES[min(bs.tier, 5)]
            bond_ctx = f"\n[Relationship tier: {tier_name}, Emotional temperature: {bs.temperature}"
            if bs.companion_mood:
                bond_ctx += f", Companion current mood: {bs.companion_mood}"
            bond_ctx += "]"
            system_prompt += bond_ctx

        api_messages.append({"role": "system", "content": system_prompt})

    if not request.messages and request.scenario:
        api_messages.append({"role": "user", "content": build_kickoff_prompt(request.scenario)})
    else:
        for m in request.messages:
            if m.role == "user" and request.scenario:
                if m.input_type == "dialogue":
                    prefix = "[Dialogue]:"
                elif m.input_type == "action":
                    prefix = "[Action]:"
                else:
                    prefix = "[Direct]:"
                api_messages.append({"role": m.role, "content": f"{prefix} {m.content}"})
            else:
                api_messages.append({"role": m.role, "content": m.content})

    if request.stream:
        return StreamingResponse(
            stream_chat(api_messages, enable_thinking=request.enable_thinking),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    reply = await call_llm(api_messages, timeout=120.0, enable_thinking=request.enable_thinking)
    return ChatResponse(reply=reply)
