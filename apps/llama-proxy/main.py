import os

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


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    reply: str


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    payload = {
        "model": "local-model",
        "messages": [m.model_dump() for m in request.messages],
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
