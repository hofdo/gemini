# Adventure Scenario Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace raw JSON as the primary scenario authoring flow with structured adventure scenario tools.

**Architecture:** Build structured scenario authoring inside `story-companion` while reusing shared API contracts. Keep JSON review as an advanced escape hatch, not the main UI.

**Tech Stack:** Angular reactive/forms or signals, shared Zod contracts, Fastify, Jest.

---

## Files

Modify:

- `apps/story-companion/src/app/features/wizard/scenario-wizard.component.ts`
- `apps/story-companion/src/app/features/wizard/scenario-wizard.component.html`
- `apps/story-companion/src/app/features/wizard/scenario-wizard.component.scss`
- `apps/story-companion/src/app/core/story-session.service.ts`
- `apps/story-companion/src/app/core/local-story.provider.ts`
- `apps/story-companion/src/app/core/puter-story.provider.ts`
- `apps/llama-proxy-ts/src/app/app.ts`

Possibly create:

- `apps/story-companion/src/app/features/scenario-editor/adventure-scenario-editor.component.ts`
- `apps/story-companion/src/app/features/scenario-editor/adventure-scenario-editor.component.html`
- `apps/story-companion/src/app/features/scenario-editor/adventure-scenario-editor.component.scss`
- `apps/story-companion/src/app/core/preset-scenario.service.ts`
- `apps/story-companion/public/scenarios/index.json`
- `apps/story-companion/public/scenarios/adventure/*.json`

Reference only:

- `libs/feature-scenario/src/lib/scenario-form/scenario-form.component.ts`
- `libs/feature-scenario/src/lib/preset-scenario.service.ts`
- `apps/llama-chat/public/scenarios`

## Constraints

- Adventure only.
- Scenario form must support title, setting, tone, player character, NPCs, and rules.
- NPCs must support simple and detailed mode.
- Generated scenario JSON must still validate with `scenarioSchema`.
- Existing session creation flow must still land in `/workspace/:id`.

## Do Not

- Do not add partner fields.
- Do not add scenario type selector.
- Do not require users to edit raw JSON for normal scenario creation.
- Do not silently reset active sessions when editing scenario.
- Do not copy legacy component wholesale if it conflicts with new session architecture.

## Task 1: Create Adventure Scenario Editor Component

- [x] Write failing tests for component behavior.

Target:

- `apps/story-companion/src/app/features/scenario-editor/adventure-scenario-editor.component.spec.ts`

Test intent:

```typescript
it('emits a valid adventure scenario with title setting tone character npcs and rules', () => {
  // Render component with initial scenario.
  // Fill required fields.
  // Emit save.
  // Assert scenario_type === 'adventure'.
  // Assert no partner fields are shown in the DOM.
});
```

- [x] Create standalone component with inputs:

```typescript
scenario: ScenarioDto | null
readonly: boolean
```

- [x] Create outputs:

```typescript
scenarioChange: EventEmitter<ScenarioDto>
validityChange: EventEmitter<boolean>
```

- [x] Fields:

  - title
  - setting
  - tone
  - character_name
  - character_description
  - npcs
  - rules

- [x] NPC editor fields:

  - name
  - description
  - mode
  - stats
  - personality
  - foes
  - friends
  - plot_twists

- [x] Validate through `scenarioSchema.parse`.

## Task 2: Replace Raw JSON As Primary Wizard UI

- [x] Update wizard to show:

  - prompt generation panel
  - preset loader
  - structured editor
  - collapsed advanced JSON panel
  - recent sessions

- [x] Keep JSON review available behind an explicit Advanced button.

- [x] On generated scenario:

  - Populate editor from `ScenarioDto`.
  - Update advanced JSON text.
  - Clear validation errors.

- [x] On editor change:

  - Update `generatedScenario`.
  - Update JSON text.
  - Disable Start until valid.

- [x] Tests must assert `Start workspace` is disabled when required fields are empty.

## Task 3: Adventure Preset Loading

- [x] Add preset service for `story-companion`.

Methods:

```typescript
loadIndex(): Promise<Array<{ id: string; label: string; path: string }>>
loadScenario(meta: { path: string }): Promise<ScenarioDto>
```

- [x] Create `apps/story-companion/public/scenarios/index.json`.

Minimum shape:

```json
[
  {
    "id": "grim-frontier",
    "label": "Grim Frontier",
    "path": "scenarios/adventure/grim-frontier.json"
  }
]
```

- [x] Copy or adapt at least one adventure preset from legacy assets.

- [x] Ensure preset load validates with `scenarioSchema`.

- [x] Do not include interpersonal presets.

## Task 4: AI NPC Generation

- [x] Add or reuse `/generate-npc` from `llama-proxy-ts`.

- [x] Strengthen `/generate-npc` tests:

  - returns JSON object
  - includes stats when model returns them
  - tolerates missing optional arrays with defaults at UI boundary

- [x] Add editor button per NPC:

```html
Generate NPC Details
```

- [x] Behavior:

  - If name/description exist, send them.
  - If empty, allow the proxy to invent them from scenario context.
  - Switch NPC to `detailed` mode after successful generation.
  - Preserve manually entered name and description unless they were empty.

- [x] Do not overwrite user-entered data without explicit field-level intent.

## Task 5: Edit Current Scenario Flow

- [x] Add workspace action `Edit Scenario`.

- [x] Route user back to wizard/editor with active session id.

- [x] On save, present explicit choices:

  - Apply and reset story messages.
  - Save as new session.
  - Cancel.

- [x] Implement only the first two choices if both can be tested. If not, implement reset only and hide fork UI.

- [x] Do not mutate active session scenario while messages remain from the previous scenario unless user confirmed reset.

## Task 6: Final Verification

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

- [x] Commit:

```bash
git add apps/story-companion apps/llama-proxy-ts
git commit -m "feat(story): add adventure scenario tooling"
```
