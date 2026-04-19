# Plan: Auto-Start Story with Scene Introduction

## Goal

When the user enters the chat after defining a scenario, automatically send the scenario to the LLM to generate an opening narration — setting the scene, establishing the mood, and giving the player context before their first input. The kickoff prompt differs by scenario type.

---

## Steps

### 1. Add `initializeStory()` to `ChatService`

**File:** `apps/llama-chat/src/app/chat/chat.service.ts`

- New method `initializeStory()`: sends a request with an **empty** `messages[]` + the active scenario.
- Sets `loading` to true, pushes the LLM's reply as the first `assistant` message.
- Guards: no-op if no active scenario, if messages already exist, or if already loading.

### 2. Add `build_kickoff_prompt(scenario)` helper in backend

**File:** `apps/llama-proxy/main.py`

Returns different wording per `scenario_type`:

**Adventure kickoff:**
```
Begin the story. Set the scene vividly — describe the environment, atmosphere, sounds, and smells. Introduce the situation the player character finds themselves in and hint at what lies ahead. Do not speak or act for the player character.
```

**Interpersonal kickoff:**
```
Set the scene for this encounter. Describe the setting and atmosphere briefly, then — as {partner_name} — initiate the first interaction with {character_name}. Stay in character, matching the tone and your character's personality. Keep it natural and conversational.
```

### 3. Update `/chat` endpoint to inject kickoff prompt

**File:** `apps/llama-proxy/main.py`

- When `messages` is empty and `scenario` is present, append the kickoff prompt as a hidden user message after the system prompt.
- The kickoff message is **not** returned to the frontend — only the LLM's response is.

### 4. Call `initializeStory()` from `ChatComponent.ngOnInit`

**File:** `apps/llama-chat/src/app/chat/chat.component.ts`

- In `ngOnInit`: if a scenario is active **and** `messages` is empty, call `chatService.initializeStory()`.
- Also re-trigger after `resetStory()` clears messages — so restarting gives a fresh intro.

### 5. Update empty-state UI for loading

**File:** `apps/llama-chat/src/app/chat/chat.component.html`

- When `loading()` is true and `messages().length === 0`: show **"Setting the scene…"** with a subtle animation instead of the generic "✨ Your story awaits!" text.
- Once the first assistant message arrives, the empty state disappears naturally.

---

## Data Flow

```
ChatComponent.ngOnInit()
  ├── scenario active + no messages
  │
  ▼
ChatService.initializeStory()
  sends: { messages: [], scenario: {...} }
  │
  ▼
POST /chat  (llama-proxy)
  ├── system prompt from scenario
  ├── detects messages == empty
  └── appends kickoff user message (adventure or interpersonal variant)
  │
  ▼
LLM generates opening narration
  │
  ▼
Response → ChatService → messages signal → first assistant bubble appears
```

---

## Considerations

- **Kickoff message is backend-only** — the frontend never sees the hidden "Begin the story…" prompt in its message history, keeping the UI clean.
- **Reset re-triggers intro** — after `resetStory()`, `initializeStory()` fires again for a fresh opening.
- **No double-fire** — guard in `initializeStory()` checks `messages().length === 0 && !loading()` to prevent duplicate calls.

