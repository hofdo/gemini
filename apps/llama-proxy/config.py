import json
import logging
import logging.handlers
import os
import threading
from pathlib import Path

_LOG_FORMAT = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"
_LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_log_dir = Path(__file__).resolve().parents[2] / "logs"
_log_dir.mkdir(exist_ok=True)
_log_file = _log_dir / "llama-proxy.log"

logger = logging.getLogger("llama-proxy")
logger.setLevel(logging.DEBUG)

_console = logging.StreamHandler()
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(_LOG_FORMAT, datefmt=_LOG_DATE_FORMAT))

_file = logging.handlers.RotatingFileHandler(
    _log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
)
_file.setLevel(logging.DEBUG)
_file.setFormatter(logging.Formatter(_LOG_FORMAT, datefmt=_LOG_DATE_FORMAT))

logger.addHandler(_console)
logger.addHandler(_file)
logger.propagate = False

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
        "context_window": 8192,
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
        "context_window": 8192,
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

logger.info("=== llama-proxy startup ===")
logger.info("Log file: %s", _log_file)
logger.info("Active backend: %s (%s)", active_backend["id"], active_backend["url"])
for b in BACKENDS:
    logger.debug("  configured backend: %s — url=%s temp=%.2f", b["id"], b["url"], b.get("temperature", 0.8))
