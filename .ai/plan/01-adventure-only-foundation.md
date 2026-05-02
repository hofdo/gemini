# Adventure-Only Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Remove the new app's interpersonal scenario path and make all new scenario generation adventure-only.

**Architecture:** Keep shared contracts backward-tolerant in this phase, but make `story-companion` and `llama-proxy-ts` request, generate, and prompt only adventure scenarios. Remove partner/interpersonal behavior from new-app prompt construction without touching legacy `llama-chat`.

**Tech Stack:** Angular 21, signals, Fastify, Zod, Jest, Nx.

---

## Files

Modify:

- `apps/story-companion/src/app/features/wizard/scenario-wizard.component.ts`
- `apps/story-companion/src/app/features/wizard/scenario-wizard.component.html`
- `apps/story-companion/src/app/core/story-session.service.ts`
- `apps/story-companion/src/app/core/story-types.ts`
- `apps/story-companion/src/app/core/local-story.provider.ts`
- `apps/story-companion/src/app/core/puter-story.provider.ts`
- `apps/story-companion/src/app/core/story-factories.ts`
- `apps/llama-proxy-ts/src/app/app.ts`
- `apps/llama-proxy-ts/src/app/prompts/story-prompts.ts`
- Existing tests under `apps/story-companion/src/app/**/*.spec.ts`
- Existing tests under `apps/llama-proxy-ts/src/app/**/*.spec.ts`

Compatibility-only, do not remove yet:

- `libs/shared/api-contracts/src/lib/schemas.ts`

## Constraints

- Keep `scenarioSchema` tolerant of existing `interpersonal` saved data for now.
- New UI must not expose an Interpersonal selector.
- New app must always call scenario generation with `scenarioType` or `scenario_type` set to `adventure`.
- Puter and local providers must both generate adventure scenarios only.
- Preserve existing provider mode behavior.

## Do Not

- Do not modify `apps/llama-chat`.
- Do not modify `apps/llama-proxy`.
- Do not delete partner fields from shared schema in this phase.
- Do not remove `dialogue` input mode.
- Do not remove recent session loading.
- Do not add data migration yet.

## Task 1: Lock the Wizard to Adventure

- [x] Write a failing test in `apps/story-companion/src/app/features/wizard/scenario-wizard.component.spec.ts` or the nearest existing wizard test.

Test intent:

```typescript
it('does not expose interpersonal scenario generation', () => {
  // Render ScenarioWizardComponent.
  // Assert no option or button contains "Interpersonal".
  // Assert generation calls StorySessionService.generateScenario with "adventure".
});
```

- [x] Run the focused test and confirm it fails because the UI still exposes Interpersonal.

```bash
npx nx test story-companion --runInBand --skip-nx-cache
```

- [x] Change `ScenarioWizardComponent` so `scenarioType` is no longer a writable union signal.

Target behavior:

```typescript
readonly scenarioType = 'adventure' as const;
```

- [x] Update `scenario-wizard.component.html` to remove the scenario type `<select>` block.

Remove this UI:

```html
<label>
  Scenario type
  <select ...>
    <option value="adventure">Adventure</option>
    <option value="interpersonal">Interpersonal</option>
  </select>
</label>
```

- [x] Update `generate()` to call:

```typescript
const scenario = await this.story.generateScenario(this.prompt(), 'adventure');
```

- [x] Run the focused test and confirm it passes.

## Task 2: Narrow New-App Scenario Generation Types

- [x] Write failing service/provider tests asserting only `adventure` is accepted by new app service methods.

Target files:

- `apps/story-companion/src/app/core/story-session.service.spec.ts`
- `apps/story-companion/src/app/core/local-story.provider.spec.ts`
- `apps/story-companion/src/app/core/puter-story.provider.spec.ts`

Test intent:

```typescript
it('sends adventure as the scenario type for local generation', async () => {
  // Mock fetch.
  // Call generateScenario(prompt, 'adventure').
  // Assert body.scenario_type === 'adventure'.
});
```

- [x] Update `StorySessionService.generateScenario` to accept only:

```typescript
scenarioType: 'adventure'
```

- [x] Update `ScenarioGenerationRequest` in `story-types.ts` to:

```typescript
scenarioType: 'adventure';
```

- [x] Update `LocalStoryProvider.generateScenario` and `PuterStoryProvider.generateScenario` signatures through `StoryProvider`.

- [x] Ensure `PuterStoryProvider.generateScenario` system prompt says adventure scenario and does not mention interpersonal partner fields.

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
```

## Task 3: Make TS Proxy Scenario Prompt Adventure-Only

- [x] Write failing proxy tests in `apps/llama-proxy-ts/src/app/app.spec.ts`.

Test 1:

```typescript
it('generates only adventure scenario prompts', async () => {
  const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(JSON.stringify(validScenario));
  const app = buildApp({ llmClient: { complete, stream: jest.fn<LlmClient['stream']>() } });

  await app.inject({
    method: 'POST',
    url: '/generate-scenario',
    payload: { description: 'ruined fortress', scenario_type: 'adventure' },
  });

  expect(complete.mock.calls[0][0][0].content).toContain('"scenario_type": "adventure"');
  expect(complete.mock.calls[0][0][0].content).not.toContain('interpersonal');
  expect(complete.mock.calls[0][0][0].content).not.toContain('partner_name');

  await app.close();
});
```

Test 2:

```typescript
it('rejects interpersonal scenario generation requests from the new proxy route', async () => {
  const app = buildApp({
    llmClient: {
      complete: jest.fn<LlmClient['complete']>(),
      stream: jest.fn<LlmClient['stream']>(),
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/generate-scenario',
    payload: { description: 'relationship drama', scenario_type: 'interpersonal' },
  });

  expect(response.statusCode).toBe(400);
  await app.close();
});
```

- [x] Run the proxy test and confirm the new tests fail.

```bash
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
```

- [x] In `apps/llama-proxy-ts/src/app/app.ts`, add a local request parser for new-app scenario generation:

```typescript
const adventureScenarioRequestSchema = generateScenarioRequestSchema.extend({
  scenario_type: z.literal('adventure').default('adventure'),
});
```

If `z` is not imported, add:

```typescript
import { z, ZodError, type ZodType } from 'zod';
```

- [x] Use `adventureScenarioRequestSchema` only in `/generate-scenario`.

- [x] Simplify `buildScenarioGenerationPrompt` to take no scenario type argument and always emit an adventure schema.

- [x] Remove partner field branches from the prompt builder.

- [x] Run:

```bash
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

## Task 4: Remove Interpersonal Chat Prompt Branches From New Proxy

- [x] Write a failing test for `buildChatMessages` or app-level `/chat` behavior proving partner prompt text is not included for adventure.

If helper is not exported, prefer testing `/chat` through `buildApp`.

- [x] In `apps/llama-proxy-ts/src/app/prompts/story-prompts.ts`, remove this behavior from new stack prompts:

```typescript
scenario.scenario_type === 'interpersonal'
  ? `Partner: ${scenario.partner_name} - ${scenario.partner_personality}\nRelationship: ${scenario.partner_relationship}`
  : ''
```

- [x] Keep NPC and rules prompt content.

- [x] Run:

```bash
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
```

## Task 5: Final Verification

- [x] Run all phase checks:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

- [x] Manually confirm the wizard shows no Interpersonal option.

- [x] Commit:

```bash
git add apps/story-companion apps/llama-proxy-ts
git commit -m "feat(story): make new app adventure only"
```
