# Plan: Add Interpersonal / Romance Scenario Type

## Goal

Currently the scenario form is geared toward adventure/fantasy (NPCs, world-building). Add support for **two-person interpersonal scenarios** (e.g. romance, drama between two characters) where the LLM plays one character and the user plays the other.

---

## Steps

### 1. Add `scenarioType` field to `Scenario` model

**File:** `apps/llama-chat/src/app/scenario/scenario.model.ts`

- Add `ScenarioType = 'adventure' | 'interpersonal'` type.
- Add `scenarioType: ScenarioType` to `Scenario` interface.
- Add optional `partnerName: string` and `partnerDescription: string` fields (used when type is `interpersonal` — the character the LLM plays).
- Add optional `relationship: string` field for context (e.g. "childhood friends", "strangers who just met").

### 2. Update `ScenarioFormComponent`

**Files:**
- `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.ts`
- `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.html`
- `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.scss`

- Add a type selector at the top (toggle or radio: 🗺️ Adventure / 💬 Interpersonal).
- Conditionally show **NPCs** section only for `adventure`.
- Show **"Other Character"** section (partner name + description + relationship) only for `interpersonal`.
- Shared fields remain: title, setting, tone, your character, rules.
- Add `scenarioType`, `partnerName`, `partnerDescription`, `relationship` form controls.
- Conditionally require partner fields when type is `interpersonal`.

### 3. Add `scenario_type` and partner fields to backend `Scenario` model

**File:** `apps/llama-proxy/main.py`

- Add `scenario_type: Literal["adventure", "interpersonal"] = "adventure"` to `Scenario` Pydantic model.
- Add `partner_name: str = ""`, `partner_description: str = ""`, `relationship: str = ""` optional fields.

### 4. Add `build_interpersonal_system_prompt()` in backend

**File:** `apps/llama-proxy/main.py`

A second prompt builder that instructs the LLM to:
- Stay in-character as the partner character.
- Respond naturally in a two-person scene.
- Respect the tone, setting, and rules.
- Treat `[Dialogue]:` as spoken words and `[Action]:` as narrative actions, same as adventure mode.

Example template:
```
You are roleplaying as {partner_name} in an interactive two-person story.

## Story: {title}

### Setting
{setting}

### Tone
{tone}

### Your Character (the one you play)
Name: {partner_name}
Description: {partner_description}

### The Other Character (played by the user)
Name: {character_name}
Description: {character_description}

### Relationship
{relationship}

### Rules
{rules}
- Stay in character as {partner_name} at all times.
- Respond naturally and emotionally, matching the tone of the scene.
- Never break character unless the user explicitly says [OOC].
- When the user's message is prefixed with [Action]:, treat it as a narrative action.
- When the user's message is prefixed with [Dialogue]:, treat it as spoken words.
- Keep responses concise (1–3 paragraphs) to maintain conversational flow.
```

### 5. Update `/chat` endpoint to pick the correct prompt builder

**File:** `apps/llama-proxy/main.py`

- If `scenario.scenario_type == "interpersonal"`: use `build_interpersonal_system_prompt()`.
- If `scenario.scenario_type == "adventure"` (or default): use existing `build_system_prompt()`.

### 6. Update `ChatService` to include new fields

**File:** `apps/llama-chat/src/app/chat/chat.service.ts`

- Map `partnerName` → `partner_name`, `partnerDescription` → `partner_description`, `relationship`, `scenarioType` → `scenario_type` in the request payload.

---

## Considerations

- **Input modes** — The Dialogue / Action toggle remains unchanged for both scenario types.
- **Prompt design** — The interpersonal prompt emphasizes natural, emotional responses and the two-character dynamic, while the adventure prompt focuses more on world-building and NPC interactions.
- **Relationship field** — Optional free-text to give the LLM more context on the dynamic between the two characters.
- **Backward compatibility** — `scenarioType` defaults to `'adventure'` so existing saved scenarios in localStorage continue to work.

---

## Out of Scope
- Multiple partner characters (keep it strictly two-person for interpersonal)
- Scenario templates / presets
- Persistent storage beyond localStorage

