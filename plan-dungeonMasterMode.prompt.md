# Plan: Dungeon Master Mode — Quest & NPC Creators

Replace the DM placeholder with a full toolkit page featuring two LLM-powered creators: a **Quest Creator** (generates quest title, description, objectives, rewards, encounters, and difficulty) and an **NPC Creator** (reuses the existing `/generate-npc` endpoint pattern but presents results as standalone cards you can save to a local collection). Both use a free-text prompt + ✨ Generate button pattern consistent with the existing AI generation UX.

## Steps

### 1. Define DM data models

Create a new `dm.model.ts` at `/apps/llama-chat/src/app/dm/dm.model.ts`:

- `DmNpc` — mirrors `Npc` with full detailed fields + `id` (uuid string)
- `Quest` — title, description, objectives `string[]`, rewards `string[]`, encounters `string[]`, difficulty (string, e.g. "Easy", "Medium", "Hard", "Deadly"), setting, estimatedDuration (string)
- `DmCollection` — saved npcs (`DmNpc[]`) and quests (`Quest[]`) arrays

### 2. Add backend endpoints

In `main.py`:

- Add `GenerateQuestRequest` Pydantic model (fields: `prompt`, `setting` optional, `tone` optional)
- Add `POST /generate-quest` endpoint — accepts the request, builds a system prompt asking for JSON matching the Quest schema, calls `call_llm`, parses JSON response (with fix retry), returns the quest dict
- Reuse existing `POST /generate-npc` for NPC creation (no changes needed)

In `proxy.conf.json`:

- Add `/generate-quest` proxy entry targeting `http://localhost:8000`

### 3. Add frontend AI methods

In `ai-assist.service.ts`:

- Add `generateQuest(prompt: string, setting?: string, tone?: string): Promise<Quest>` — POSTs to `/generate-quest`, maps snake_case response to camelCase `Quest` interface

### 4. Build out `DmComponent`

In `dm.component.ts`:

- Replace the placeholder with a tabbed layout (Quests / NPCs tabs)
- Each tab has:
  - A text prompt area + ✨ Generate button
  - A results card showing the generated item with all fields (editable)
  - A "💾 Save to Collection" button
- Use signals for `generatingQuest`, `generatingNpc`, `savedQuests`, `savedNpcs` (persisted to `localStorage`)
- Active tab signal (`activeTab: 'quests' | 'npcs'`)
- Methods: `generateQuest()`, `generateNpc()`, `saveQuest()`, `saveNpc()`, `deleteQuest(id)`, `deleteNpc(id)`, `goBack()`

### 5. Create the DM template & styles

In `dm.component.html`:

- ⬅️ Back to Menu button at top
- Tab bar (Quests / NPCs) with active styling
- **Quest tab:**
  - Prompt textarea + optional setting/tone inputs (collapsed under "⚙️ Advanced" toggle)
  - ✨ Generate Quest button (disabled while generating)
  - Generated quest result card: title, description, objectives list, rewards list, encounters list, difficulty badge, estimated duration
  - Editable fields (inputs/textareas) pre-filled from generation
  - 💾 Save to Collection button
  - 📋 Saved Quests section — collapsible list of saved quest cards with 🗑️ delete button
- **NPC tab:**
  - Prompt textarea (name + description fields, or free-text)
  - Optional setting/tone inputs under "⚙️ Advanced" toggle
  - ✨ Generate NPC button
  - Generated NPC result card: name, description, personality, stats grid (STR/DEX/CON/INT/WIS/CHA), foes/friends/plot twists lists
  - Editable fields pre-filled from generation
  - 💾 Save to Collection button
  - 📋 Saved NPCs section — collapsible list of saved NPC cards with 🗑️ delete button

In `dm.component.scss`:

- Reuse existing dark theme (`#1a1a2e`, `#16213e`, `#0f3460`, `#533483`)
- Tab bar styling (active tab highlighted)
- Result card styling (border, padding, sections)
- Stats grid (3-column like existing)
- Difficulty badge (color-coded: green/yellow/orange/red)
- Saved collection section styling

### 6. Wire up routes

No routing changes needed — DM page already at `/dm` with ⬅️ Back to Menu button.

## Considerations

1. **Should saved DM NPCs/Quests be usable in Adventure mode?** Recommendation: No for now — keep them as a standalone reference tool. We can add an "Export to Scenario" feature later.

2. **Should the NPC creator in DM mode offer manual editing after generation, or stay read-only until saved?** Recommendation: Show an editable form that pre-fills from LLM output — same pattern as the adventure NPC ✨ button — so users can tweak before saving.

3. **Should the Quest creator include an optional "setting" and "tone" input field, or just a single free-text prompt?** Recommendation: A single prompt field plus optional setting/tone inputs collapsed under an "Advanced" toggle, keeping the UI clean by default.

