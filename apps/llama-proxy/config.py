import json
import logging
import os
import threading

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("llama-proxy")

_DEFAULT_BACKENDS: list[dict] = [
    {
        "id": "gemma4-uncensored",
        "name": "Gemma 4 Uncensored (Q6_K_P)",
        "url": os.getenv("LLAMA_CPP_URL", "http://localhost:8080"),
        "model": "local-model",
        "temperature": 1.0,
        "top_p": 0.95,
        "top_k": 64,
        "repeat_penalty": 1.0,
        "system_prompt_style": "narrative",
    },
    {
        "id": "qwen3-uncensored",
        "name": "Qwen 3.5 9B Uncensored (Q8_0)",
        "url": os.getenv("LLAMA_CPP_URL", "http://localhost:8080"),
        "model": "local-model",
        "temperature": 0.7,
        "top_p": 0.8,
        "top_k": 20,
        "min_p": 0.0,
        "repeat_penalty": 1.0,
        "system_prompt_style": "narrative",
    },
]


def _load_backends() -> list[dict]:
    raw = os.getenv("AVAILABLE_BACKENDS")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            logger.warning("Failed to parse AVAILABLE_BACKENDS env var — using defaults")
    return _DEFAULT_BACKENDS


BACKENDS: list[dict] = _load_backends()
_default_id = os.getenv("ACTIVE_BACKEND_ID", "gemma4-uncensored")
active_backend: dict = next((b for b in BACKENDS if b["id"] == _default_id), BACKENDS[0])
_backend_lock = threading.Lock()
