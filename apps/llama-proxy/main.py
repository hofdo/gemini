import os
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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


class ChatResponse(BaseModel):
    reply: str


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
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
