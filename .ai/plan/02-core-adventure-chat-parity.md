# Core Adventure Chat Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bring `story-companion` workspace chat up to the legacy adventure chat experience without adding interpersonal features.

**Architecture:** Keep `StorySessionService` as the session orchestrator and keep provider-specific behavior behind `StoryProvider`. Add focused UI/service methods for chat controls instead of copying the legacy monolithic `ChatComponent`.

**Tech Stack:** Angular 21 standalone components, signals, IndexedDB, Fastify SSE, Jest.

---

## Files

Modify:

- `apps/story-companion/src/app/features/workspace/story-workspace.component.ts`
- `apps/story-companion/src/app/features/workspace/story-workspace.component.html`
- `apps/story-companion/src/app/features/workspace/story-workspace.component.scss`
- `apps/story-companion/src/app/core/story-session.service.ts`
- `apps/story-companion/src/app/core/local-story.provider.ts`
- `apps/story-companion/src/app/core/puter-story.provider.ts`
- `apps/story-companion/src/app/core/story-types.ts`
- `apps/llama-proxy-ts/src/app/app.ts`
- `apps/llama-proxy-ts/src/app/prompts/story-prompts.ts`

Possibly create:

- `apps/story-companion/src/app/core/chat-rendering.service.ts`
- `apps/story-companion/src/app/core/adventure-assist.service.ts`

Reference only:

- `libs/feature-chat/src/lib/chat.component.ts`
- `libs/feature-chat/src/lib/chat.component.html`
- `libs/feature-chat/src/lib/chat.service.ts`

## Constraints

- Preserve `StorySessionRepository` and session list behavior.
- Preserve `providerMode` per session.
- Keep `dialogue`, `action`, `direct`, and `remember` as input modes.
- Ensure all destructive actions require explicit confirmation.
- Chat controls must work for both local provider and Puter provider where technically possible.

## Do Not

- Do not add bond indicators, partner fields, partner relationship UI, or interpersonal badges.
- Do not replace IndexedDB with legacy localStorage message persistence.
- Do not render unsanitized markdown.
- Do not let failed AI assist or world updates delete user messages.
- Do not add large unrelated UI redesigns.

## Task 1: Markdown And Think Rendering

- [x] Write a failing test for rendering behavior.

Target:

- `apps/story-companion/src/app/core/chat-rendering.service.spec.ts`

Test intent:

```typescript
it('renders markdown and wraps think blocks in details', () => {
  const html = service.render('**Bold**<think>hidden</think>');
  expect(html).toContain('<strong>Bold</strong>');
  expect(html).toContain('<details');
  expect(html).not.toContain('<script');
});
```

- [x] Create `ChatRenderingService`.

Implementation requirements:

- Use `marked`.
- Use Angular `DomSanitizer.sanitize(SecurityContext.HTML, ...)`.
- Convert `<think>...</think>` into a collapsible details block before markdown parsing.

- [x] Update workspace template to use `[innerHTML]` only for assistant messages.

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
```

## Task 2: Auto-Scroll And Composer Ergonomics

- [x] Add test coverage for `send()` clearing the draft and not sending empty text.

- [x] Add `ViewChild` references for message list and textarea in `StoryWorkspaceComponent`.

- [x] Add an `effect()` that reads `messages()` and `loading()` and scrolls the message list after DOM update.

- [x] Add Enter-to-send and Shift+Enter-newline behavior.

- [x] Add mode buttons with stable dimensions and labels:

```html
Dialogue
Action
Direct
Remember
```

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
```

## Task 3: Stop, Regenerate, Retry, Reset, New, Change

- [x] Write failing tests for session service methods:

Target:

- `apps/story-companion/src/app/core/story-session.service.spec.ts`

Required methods:

```typescript
cancelGeneration(): void
regenerateLastResponse(): Promise<void>
retryLastResponse(): Promise<void>
resetCurrentStory(): Promise<void>
deleteSession(id: string): Promise<void>
```

- [x] Extend provider interface to support cancellation for local provider.

Local provider requirement:

- Store an `AbortController` for active stream.
- Abort on `cancelGeneration()`.
- Do not persist an empty assistant message after abort.

Puter provider requirement:

- If cancellation is not supported by the Puter SDK, make `cancelGeneration()` mark local service state as not loading after the current operation resolves.
- Do not claim true remote cancellation unless verified.

- [x] Add workspace confirmation state for:

```typescript
'reset' | 'new' | 'change' | 'delete' | null
```

- [x] Implement UI buttons:

```html
Stop
Regenerate
Retry
Reset
New
Edit
Delete
```

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
```

## Task 4: Context Warning, Trim, Export And Reset

- [x] Add token estimate computed from message content length divided by 4.

- [x] Add context thresholds based on active backend context window if available, otherwise use `8192`.

- [x] Add methods:

```typescript
trimContext(keepLast: number): Promise<void>
exportSessionToJson(): string
exportAndReset(): Promise<void>
```

- [x] UI requirements:

  - Show warning at 50 percent context.
  - Show critical style at 75 percent context.
  - Let the user choose how many recent messages to keep.
  - Export should include scenario, messages, world state, provider mode, timestamps.

- [x] Do not auto-download without user action.

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
```

## Task 5: AI Suggest And Rewrite

- [x] Write tests for request payloads.

Target:

- `apps/story-companion/src/app/core/adventure-assist.service.spec.ts`

Payload must include:

```json
{
  "mode": "suggest",
  "current_text": "",
  "input_type": "action",
  "scenario": {},
  "messages": []
}
```

- [x] Create `AdventureAssistService` that calls `/assist`.

- [x] Add workspace button:

  - Empty draft: suggest next input.
  - Non-empty draft: rewrite current input.
  - Disable while chat or assist is loading.

- [x] Ensure service never mutates messages directly.

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
```

## Task 6: Oracle

- [x] Add `/generate-oracle` to `llama-proxy-ts`.

Supported oracle types:

```typescript
'npc_name' | 'location_name' | 'quest_hook'
```

- [x] Add request/response schema locally or in shared contracts:

```typescript
{
  oracle_type: 'npc_name' | 'location_name' | 'quest_hook';
  world_state_summary?: string;
  scenario_title?: string;
  setting?: string;
}
```

- [x] Add proxy tests for all three oracle types.

- [x] Add workspace oracle panel with:

  - NPC Name
  - Location
  - Quest Hook
  - Recent oracle results

- [x] Do not make oracle mandatory for chat.

- [x] Run:

```bash
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx test story-companion --runInBand --skip-nx-cache
```

## Task 7: Final Verification

- [x] Run:

```bash
npx nx test story-companion --runInBand --skip-nx-cache
npx nx test llama-proxy-ts --runInBand --skip-nx-cache
npx nx build story-companion --skip-nx-cache
npx nx build llama-proxy-ts --skip-nx-cache
```

- [x] Commit:

```bash
git add apps/story-companion apps/llama-proxy-ts libs/shared/api-contracts
git commit -m "feat(story): restore core adventure chat controls"
```
