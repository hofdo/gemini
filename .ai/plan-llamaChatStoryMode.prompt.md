# Plan: Llama Chat – Story/Scenario Mode

## Goal

Extend `llama-chat` (Angular frontend) and `llama-proxy` (FastAPI backend) to support interactive story scenarios powered by a local Gemini 4 instance (accessed via an OpenAI-compatible API).

The user defines a scenario (setting, character, tone, NPCs, rules), which is injected as a system prompt to guide the LLM as a storyteller. The user interacts either as their character (dialogue) or as a narrator (action/description). The LLM responds in-character as the story guide.

---

## Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Scenario fields | Full set: title, setting, tone/genre, player character (name + description), NPC list, hard rules |
| 2 | Storage | Ephemeral per session + `localStorage` so refresh doesn't lose the scenario |
| 3 | Input modes | Toggle switch (🗣 Dialogue / ⚔️ Action) + formatted prefix in prompt (`[Dialogue]:` / `[Action]:`) |
| 4 | LLM access | Local Gemini 4 via existing OpenAI-compatible proxy structure (keep `httpx` + `/v1/chat/completions`) |
| 5 | Session history | Frontend holds full history, sends it with every request (as today) |
| 6 | UI scope | Separate `/scenario` route; editable mid-session with a warning that it resets the story |

---

## Current State

### `llama-proxy` (FastAPI)
- Single `/chat` POST endpoint forwarding `messages[]` to `/v1/chat/completions`
- No system prompt support, no scenario awareness

### `llama-chat` (Angular)
- Single `ChatComponent` with textarea + send button
- `ChatService` holds message history as a signal, no routing

---

## Architecture

### Backend – `apps/llama-proxy/main.py`

#### New Pydantic Models

```python
class NPC(BaseModel):
    name: str
    description: str

class Scenario(BaseModel):
    title: str
    setting: str
    tone: str
    character_name: str
    character_description: str
    npcs: list[NPC] = []
    rules: list[str] = []

class StoryMessage(BaseModel):
    role: str                        # 'user' | 'assistant'
    content: str
    input_type: str = "dialogue"     # 'dialogue' | 'action'

class StoryChatRequest(BaseModel):
    messages: list[StoryMessage]
    scenario: Scenario | None = None
```

#### System Prompt Builder

```python
def build_system_prompt(scenario: Scenario) -> str:
    npc_block = "\n".join(f"- {n.name}: {n.description}" for n in scenario.npcs) or "None defined."
    rules_block = "\n".join(f"- {r}" for r in scenario.rules) or "None."
    return f"""You are the storyteller and game master of an interactive story.

## Story: {scenario.title}

### Setting
{scenario.setting}

### Tone
{scenario.tone}

### Player Character
Name: {scenario.character_name}
Description: {scenario.character_description}

### NPCs
{npc_block}

### Rules
{rules_block}
- Always respond in-world, in the tone of the setting.
- Never break character unless the player explicitly says [OOC].
- Guide the story forward; introduce tension, NPCs, and consequences naturally.
- Keep responses concise (2–4 paragraphs) unless dramatic scenes call for more.
- When the player's message is prefixed with [Action]:, treat it as a narrative action or description.
- When the player's message is prefixed with [Dialogue]:, treat it as spoken words from the player character.
"""
```

#### Updated `/chat` Endpoint

- Accept `StoryChatRequest` (`scenario` is optional for backward compatibility)
- If `scenario` present: prepend a `system` message from `build_system_prompt`
- Format user messages with `[Dialogue]:` or `[Action]:` prefix based on `input_type`
- Forward enriched messages to local Gemini 4 at `LLAMA_CPP_URL/v1/chat/completions`

---

### Frontend – `apps/llama-chat/src/app/`

#### New Files

| File | Purpose |
|------|---------|
| `scenario/scenario.model.ts` | TypeScript interfaces: `Scenario`, `Npc`, `InputType` |
| `scenario/scenario.service.ts` | Signal-based service; saves/loads from `localStorage` |
| `scenario/scenario-form/scenario-form.component.ts` | Reactive form for creating/editing a scenario |
| `scenario/scenario-form/scenario-form.component.html` | Form template |
| `scenario/scenario-form/scenario-form.component.scss` | Styles |

#### Modified Files

| File | Changes |
|------|---------|
| `app.routes.ts` | Add `/scenario` → `ScenarioFormComponent`, `/chat` → `ChatComponent`, redirect `/` → `/scenario` |
| `chat/chat.service.ts` | Include `scenario` + `input_type` per message in request payload |
| `chat/chat.component.ts` | Inject `ScenarioService`; add `inputType` signal; "Change scenario" button with reset confirmation |
| `chat/chat.component.html` | Input mode toggle, scenario title in header, "Change scenario" link |
| `chat/chat.component.scss` | Styles for toggle and scenario header |

#### `scenario.model.ts`

```typescript
export type InputType = 'dialogue' | 'action';

export interface Npc {
  name: string;
  description: string;
}

export interface Scenario {
  title: string;
  setting: string;
  tone: string;
  characterName: string;
  characterDescription: string;
  npcs: Npc[];
  rules: string[];
}
```

#### `scenario.service.ts`

- `activeScenario = signal<Scenario | null>(null)`
- `setScenario(s: Scenario)` – sets signal + saves to `localStorage`
- `clearScenario()` – clears signal + removes from `localStorage`
- On construction: loads from `localStorage` if present

#### `ScenarioFormComponent`

- Route: `/scenario`
- Reactive form sections: Basic Info, Tone, Character, NPCs (dynamic list), Rules (dynamic list)
- "Start Story" button → `scenarioService.setScenario(...)` → navigate to `/chat`
- If navigating here from `/chat` (mid-session edit): shows confirmation "This will reset your current story. Continue?"

#### `ChatComponent` updates

- Header shows scenario title + "✏️ Change" button → navigate to `/scenario` (with reset confirmation)
- If no active scenario on init → auto-redirect to `/scenario`
- Input mode toggle: `🗣 Dialogue` | `⚔️ Action` — component signal `inputType: InputType`
- On send: passes `inputType` to `chatService.sendMessage(text, inputType)`

#### `ChatService` updates

- `sendMessage(content: string, inputType: InputType = 'dialogue')`
- `ChatMessage` gains optional `inputType` field
- Request payload: `{ messages: StoryMessage[], scenario: Scenario | null }`

---

## Data Flow

```
User fills ScenarioForm
        │
        ▼
ScenarioService.setScenario() ──► localStorage
        │
        ▼
Navigate to /chat
        │
User types message + selects Dialogue or Action mode
        │
        ▼
ChatService.sendMessage(text, inputType)
  builds: { messages: StoryMessage[], scenario: Scenario }
        │
        ▼
POST /chat  (llama-proxy)
  ├── build_system_prompt(scenario) → prepend { role: "system", content: "..." }
  └── prefix user messages with [Dialogue]: or [Action]:
        │
        ▼
Local Gemini 4  /v1/chat/completions
        │
        ▼
reply ──► ChatService ──► messages signal ──► ChatComponent
```

---

## Out of Scope (for now)
- Backend session state / server-side history
- Persisting scenarios or story transcripts to a DB
- Pre-defined scenario templates
- Multi-user / multiplayer sessions
- Voice input/output
- Image generation for scenes

