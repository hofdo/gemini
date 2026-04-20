import json
import os
from typing import AsyncGenerator, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

LLAMA_CPP_URL = os.getenv("LLAMA_CPP_URL", "http://localhost:8080")

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

class NPC(BaseModel):
    name: str
    description: str


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
    partner_description: str = ""
    relationship: str = ""


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


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(scenario: Scenario) -> str:
    npc_block = "\n".join(f"- {n.name}: {n.description}" for n in scenario.npcs) or "None defined."
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
    relationship_line = f"\n### Relationship\n{scenario.relationship}\n" if scenario.relationship else ""
    return (
        f"You are roleplaying as {scenario.partner_name} in an interactive two-person story.\n\n"
        f"## Story: {scenario.title}\n\n"
        f"### Setting\n{scenario.setting}\n\n"
        f"### Tone\n{scenario.tone}\n\n"
        f"### Your Character (the one you play)\n"
        f"Name: {scenario.partner_name}\n"
        f"Description: {scenario.partner_description}\n\n"
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


# ---------------------------------------------------------------------------
# LLM call helper (non-streaming)
# ---------------------------------------------------------------------------

async def call_llm(messages: list[dict[str, str]], timeout: float = 30.0) -> str:
    payload = {"model": "local-model", "messages": messages}
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(
                f"{LLAMA_CPP_URL}/v1/chat/completions", json=payload,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Cannot reach llama.cpp: {exc}") from exc
    data = resp.json()
    return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(request: ChatRequest):
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
            scenario_context += f"Partner character: {request.scenario.partner_name} — {request.scenario.partner_description}\n"
            scenario_context += f"Relationship: {request.scenario.relationship}\n"

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
    if request.scenario_type == "interpersonal":
        schema_fields = (
            '{\n'
            '  "scenario_type": "interpersonal",\n'
            '  "title": "string",\n'
            '  "setting": "string (detailed)",\n'
            '  "tone": "string",\n'
            '  "character_name": "string",\n'
            '  "character_description": "string (detailed)",\n'
            '  "partner_name": "string",\n'
            '  "partner_description": "string (detailed)",\n'
            '  "relationship": "string",\n'
            '  "npcs": [],\n'
            '  "rules": ["string", ...]\n'
            '}'
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
            '  "npcs": [{"name": "string", "description": "string"}, ...],\n'
            '  "partner_name": "",\n'
            '  "partner_description": "",\n'
            '  "relationship": "",\n'
            '  "rules": ["string", ...]\n'
            '}'
        )

    system = (
        "You are a creative scenario designer for interactive stories.\n"
        "Generate a complete, detailed scenario based on the user's description.\n"
        "Output ONLY valid JSON matching this exact schema — no markdown, no explanation:\n\n"
        f"{schema_fields}\n\n"
        "Make the setting vivid (2-3 sentences), character descriptions detailed (1-2 sentences each), "
        "include 2-4 rules, and for adventure scenarios include 2-3 NPCs."
    )

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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
