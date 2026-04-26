import json

try:
    from json_repair import repair_json as _repair_json

    _HAS_JSON_REPAIR = True
except ImportError:
    _HAS_JSON_REPAIR = False


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def _extract_json_object(text: str) -> str:
    """Find and return the first complete {...} JSON object in text."""
    text = _strip_fences(text)
    start = text.find("{")
    if start == -1:
        return text
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return text[start:]


def _parse_with_repair(raw: str) -> dict:
    """Parse JSON with json-repair fallback for malformed LLM output."""
    cleaned = _extract_json_object(raw)
    if _HAS_JSON_REPAIR:
        repaired = _repair_json(cleaned, return_objects=True)
        if isinstance(repaired, dict):
            return repaired  # type: ignore[return-value]
    return json.loads(cleaned)


def _fix_retry_messages(raw: str, schema_hint: str = "") -> list[dict]:
    instruction = (
        "The following text is not valid JSON. Extract or reconstruct it as a single valid JSON object. "
        "Output ONLY the corrected JSON — no markdown, no explanation, no extra text."
    )
    if schema_hint:
        instruction += f"\n\nExpected schema:\n{schema_hint}"
    return [
        {"role": "system", "content": instruction},
        {"role": "user", "content": raw},
    ]
