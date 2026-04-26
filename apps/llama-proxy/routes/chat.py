from fastapi import APIRouter
from fastapi.responses import StreamingResponse

import config
from llm import call_llm, stream_chat
from models import ChatRequest, ChatResponse
from prompts import build_interpersonal_system_prompt, build_kickoff_prompt, build_system_prompt

router = APIRouter()


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
            system_prompt = build_interpersonal_system_prompt(request.scenario)
        else:
            system_prompt = build_system_prompt(request.scenario)
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
