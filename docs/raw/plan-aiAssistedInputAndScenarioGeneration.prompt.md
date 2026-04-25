# Plan: AI-Assisted Input & Scenario Generation

## Goal

Two features: (1) an ✨ AI button in the chat input that generates or rewrites the user's message, and (2) a "Write Scenario with AI" button on the scenario form that generates a full scenario from a rough description.

---

## Steps

### 1. Add `/assist` endpoint to backend

**File:** `apps/llama-proxy/main.py`

New Pydantic models + endpoint:

```python
class AssistRequest(BaseModel):
    mode: Literal["suggest", "rewrite"]
    current_text: str = ""
    input_type: Literal["dialogue", "action"] = "dialogue"
    scenario: Scenario | None = None
    messages: list[StoryMessage] = []

class AssistResponse(BaseModel):
    text: str
```

- **`mode: "suggest"`** (textarea empty) — system prompt instructs the LLM: "Given the scenario, the conversation so far, and the input type (dialogue/action), suggest what the player character might say or do next. Output ONLY the suggested text, nothing else." Returns a short suggestion.
- **`mode: "rewrite"`** (textarea has text) — system prompt: "Rewrite and enhance the following player input to be more vivid, in-character, and fitting for the scenario. Keep the same intent. Output ONLY the rewritten text." Returns the enhanced version.
- Non-streaming (fast, short responses). Returns `{ text: "..." }`.

### 2. Add `/generate-scenario` endpoint to backend

**File:** `apps/llama-proxy/main.py`

```python
class GenerateScenarioRequest(BaseModel):
    description: str
    scenario_type: Literal["adventure", "interpersonal"] = "adventure"
```

- System prompt instructs the LLM to generate a complete scenario JSON matching the `Scenario` model fields, based on the user's rough description and the selected type.
- Prompt includes the exact JSON schema so the LLM returns parseable output.
- Backend parses the LLM response as JSON, validates with Pydantic, returns the `Scenario` object.
- Non-streaming.

### 3. Add `AiAssistService` to frontend

**File:** `apps/llama-chat/src/app/shared/ai-assist.service.ts` (new)

- `suggestInput(messages, scenario, inputType): Promise<string>` — calls `POST /assist` with `mode: "suggest"`.
- `rewriteInput(text, messages, scenario, inputType): Promise<string>` — calls `POST /assist` with `mode: "rewrite"`.
- `generateScenario(description, scenarioType): Promise<Scenario>` — calls `POST /generate-scenario`.
- All use plain `fetch()` (non-streaming, quick responses).

### 4. Add ✨ AI button to chat input row

**Files:**
- `apps/llama-chat/src/app/chat/chat.component.ts`
- `apps/llama-chat/src/app/chat/chat.component.html`
- `apps/llama-chat/src/app/chat/chat.component.scss`

- Add an `✨` button between the input toggle and the textarea.
- `aiAssisting` signal to show a small loading state on the button.
- On click:
  - If `input()` is empty → call `aiAssistService.suggestInput(...)` → set result into `input()`.
  - If `input()` has text → call `aiAssistService.rewriteInput(...)` → replace `input()` with result.
- Button disabled while `loading()` or `aiAssisting()`.
- Tooltip changes: "✨ Suggest" when empty, "✨ Enhance" when text present.

### 5. Add "Write Scenario with AI" to scenario form

**Files:**
- `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.ts`
- `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.html`
- `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.scss`

- Add a section above the form (or as a collapsible panel) with:
  - A textarea: "Roughly describe your scenario…"
  - A button: "✨ Write Scenario with AI"
- `generatingScenario` signal for loading state.
- On click: call `aiAssistService.generateScenario(description, scenarioType)`.
- On success: `form.patchValue(result)` to prefill all fields; populate NPCs/rules FormArrays from the response.
- User can then review and edit before starting.

### 6. Add proxy routes for new endpoints

**File:** `apps/llama-chat/proxy.conf.json`

- Add `/assist` and `/generate-scenario` entries pointing to `http://localhost:8000`.

---

## Data Flow

### AI Assist (chat input)

```
User clicks ✨ button
        │
        ├── input empty → mode: "suggest"
        └── input has text → mode: "rewrite"
        │
        ▼
AiAssistService.suggestInput() / rewriteInput()
  POST /assist { mode, current_text, input_type, scenario, messages }
        │
        ▼
/assist endpoint (llama-proxy)
  ├── builds system prompt for suggest or rewrite
  └── calls llama.cpp (non-streaming)
        │
        ▼
Response { text: "..." } → sets input() signal → textarea updates
```

### AI Scenario Generation

```
User types rough description + clicks "✨ Write Scenario with AI"
        │
        ▼
AiAssistService.generateScenario(description, scenarioType)
  POST /generate-scenario { description, scenario_type }
        │
        ▼
/generate-scenario endpoint (llama-proxy)
  ├── system prompt with JSON schema
  └── calls llama.cpp (non-streaming)
        │
        ▼
Response: Scenario JSON → form.patchValue() → all fields prefilled
```

---

## Considerations

- **JSON parsing reliability** — The `/generate-scenario` endpoint should include a retry or fallback if the LLM returns malformed JSON. Wrapping the LLM output extraction in a try/catch with a second attempt using a "fix this JSON" prompt is a good safety net.
- **Assist latency** — These are short, non-streaming calls. Consider setting a shorter timeout (e.g. 30s) and showing a spinner on the button only.
- **Keyboard shortcut** — Consider `Ctrl+Space` or `Tab` as a shortcut for the AI assist button in the chat input for power users.

