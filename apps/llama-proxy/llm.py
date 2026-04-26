import json
from collections.abc import AsyncGenerator

import httpx
from fastapi import HTTPException

import config


def _build_payload(
    backend: dict,
    messages: list[dict],
    *,
    stream: bool = False,
    json_mode: bool = False,
    enable_thinking: bool = False,
    temperature: float | None = None,
) -> dict:
    payload: dict = {
        "model": backend["model"],
        "messages": messages,
        "temperature": temperature if temperature is not None else backend.get("temperature", 0.8),
        "top_p": backend.get("top_p", 0.95),
        "top_k": backend.get("top_k", 50),
        "repeat_penalty": backend.get("repeat_penalty", 1.0),
        "min_p": backend.get("min_p", 0.05),
    }
    if stream:
        payload["stream"] = True
    if json_mode:
        # Forces llama.cpp JSON grammar — constrains sampling to valid JSON, eliminates preamble text.
        payload["response_format"] = {"type": "json_object"}
    if enable_thinking:
        payload["thinking"] = {"type": "enabled", "budget_tokens": 1024}
    return payload


async def stream_chat(
    api_messages: list[dict[str, str]], enable_thinking: bool = False
) -> AsyncGenerator[str, None]:
    with config._backend_lock:
        backend = config.active_backend
    payload = _build_payload(backend, api_messages, stream=True, enable_thinking=enable_thinking)
    config.logger.info(
        ">>> LLM stream request (%d messages, backend=%s)", len(api_messages), backend["id"]
    )
    for msg in api_messages:
        preview = msg["content"][:200] + ("…" if len(msg["content"]) > 200 else "")
        config.logger.info("    [%s] %s", msg["role"], preview)

    collected = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{backend['url']}/v1/chat/completions",
            json=payload,
        ) as resp:
            async for line in resp.aiter_lines():
                if line.startswith("data: [DONE]"):
                    yield "data: [DONE]\n\n"
                    break
                if line.startswith("data: "):
                    yield line + "\n\n"
                    try:
                        chunk = json.loads(line[6:])
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            collected.append(delta)
                    except Exception:
                        pass

    full = "".join(collected)
    config.logger.info(
        "<<< LLM stream response (%d chars): %s",
        len(full),
        full[:300] + ("…" if len(full) > 300 else ""),
    )


async def call_llm(
    messages: list[dict[str, str]],
    timeout: float = 30.0,
    json_mode: bool = False,
    enable_thinking: bool = False,
    temperature: float | None = None,
) -> str:
    with config._backend_lock:
        backend = config.active_backend
    payload = _build_payload(
        backend,
        messages,
        json_mode=json_mode,
        enable_thinking=enable_thinking,
        temperature=temperature,
    )
    config.logger.info(
        ">>> LLM request (%d messages, timeout=%.0fs, backend=%s, json_mode=%s)",
        len(messages),
        timeout,
        backend["id"],
        json_mode,
    )
    for msg in messages:
        preview = msg["content"][:200] + ("…" if len(msg["content"]) > 200 else "")
        config.logger.info("    [%s] %s", msg["role"], preview)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(f"{backend['url']}/v1/chat/completions", json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            config.logger.error("<<< LLM HTTP error: %s", exc)
            raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
        except httpx.RequestError as exc:
            config.logger.error("<<< LLM connection error: %s", exc)
            raise HTTPException(status_code=502, detail=f"Cannot reach llama.cpp: {exc}") from exc

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    config.logger.info(
        "<<< LLM response (%d chars): %s",
        len(content),
        content[:300] + ("…" if len(content) > 300 else ""),
    )
    return content
