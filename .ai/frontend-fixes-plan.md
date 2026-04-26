# Frontend Fixes Plan — llama-chat

Generated: 2026-04-26  
Scope: Angular app at `apps/llama-chat/src/app`

---

## Phase 0: Documentation & Code Verification (DONE)

Files read:
- `chat/chat.service.ts` — `_abortController` at L17, `streamRequest` at L141, `streamWithRetry` at L195
- `chat/chat.component.ts` — `renderMarkdown` at L57-64, `_scrollEffect` at L37, `ngOnInit` at L46
- `chat/chat.component.html` — `[innerHTML]` at L85, `$any()` at L107
- `shared/ai-assist.service.ts` — 4 fetch calls at L30, L85, L110, L200; no `AbortSignal`
- `scenario/scenario-form/scenario-form.component.ts` — constructor at L53-74, `applyTypeValidators` at L107-114
- `shared/settings.service.ts` — `_patchBackend` at L82-88 (no `res.ok` check), `setActiveBackend` at L58-62
- `dm/dm.component.ts` — 4 localStorage writes at L199, L208, L351, L360; error signals `questError`/`npcError`
- `shared/error-boundary.component.ts` — `*ngIf` in inline template at L7

**Corrections from initial analysis:**
- `settings.component.ts ngOnInit` IS correctly awaited — no issue
- `scenario-form` validator order IS correct — `updateValueAndValidity()` called at L113
- Route param already has a type guard (L56) — just no redirect on invalid mode (low priority)

**Allowed APIs confirmed from source:**
- `AbortSignal.timeout(ms)` — built-in browser API, no import needed
- `DomSanitizer.sanitize(SecurityContext.HTML, html)` from `@angular/platform-browser`
- `environment.timeoutMs = 30000`, `environment.retryAttempts = 2` from `environments/environment.ts`

---

## Phase 1: Critical — Race Condition, Dead Code, XSS (defense-in-depth)

### Task 1.1 — Abort controller race condition + loading guard
**File:** `apps/llama-chat/src/app/chat/chat.service.ts`

- L141: Before `this._abortController = new AbortController()` add `this._abortController?.abort()`
- L60 `initializeStory()`: add `if (this.loading()) return;` as first line
- L72 `sendMessage()`: add `if (this.loading()) return;` as first line  
- L88 `regenerateLastResponse()`: add `if (this.loading()) return;` as first line

### Task 1.2 — Wire streamWithRetry
**File:** `apps/llama-chat/src/app/chat/chat.service.ts`

`streamWithRetry()` (L195) exists with retry logic using `environment.retryAttempts` but is never called.

- In `initializeStory()`: change `this.streamRequest(payload)` → `this.streamWithRetry(payload)`
- In `sendMessage()`: change `this.streamRequest(payload)` → `this.streamWithRetry(payload)`
- In `regenerateLastResponse()`: change `this.streamRequest(payload)` → `this.streamWithRetry(payload)`

### Task 1.3 — XSS defense-in-depth for markdown rendering
**File:** `apps/llama-chat/src/app/chat/chat.component.ts`

`renderMarkdown()` at L57-64 injects LLM thinking-block content into `<details>` HTML wrapper at string level before Angular's `[innerHTML]` sanitizer runs. Angular's default sanitizer mitigates most vectors, but explicit sanitization makes the security boundary explicit.

- Add to imports: `import { DomSanitizer, SecurityContext } from '@angular/platform-browser';`
- Add to injections: `private readonly _sanitizer = inject(DomSanitizer);`
- Change `renderMarkdown` return type from `string` to `string`
- Wrap final return: `return this._sanitizer.sanitize(SecurityContext.HTML, marked.parse(processed) as string) ?? '';`
- Template stays as `[innerHTML]="renderMarkdown(msg.content)"` — no change needed

**Verification:**
```bash
npx nx test llama-chat
# Confirm: no console SecurityContext warnings
# Confirm: <think> blocks still render as <details> elements
```

---

## Phase 2: High — Timeouts, Error Exposure, Type Safety

### Task 2.1 — Add fetch timeouts to ai-assist.service.ts
**File:** `apps/llama-chat/src/app/shared/ai-assist.service.ts`

- Add import: `import { environment } from '../../environments/environment';`
- 4 fetch calls at L30 (`generateScenario`), L85 (`generateNpc`), L110 (`generateQuest`), L200 (`callAssist`)
- Add `signal: AbortSignal.timeout(environment.timeoutMs)` to the options object of each fetch call

Example pattern (apply to all 4):
```typescript
const response = await fetch('/generate-scenario', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  signal: AbortSignal.timeout(environment.timeoutMs),
  body: JSON.stringify({ ... }),
});
```

### Task 2.2 — Expose scenario generation error in scenario-form
**File:** `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.ts`

`generateWithAi()` catch block at L324-325 only does `console.error`. `npcGenerationError` signal exists but no equivalent for scenario generation.

- Add signal: `scenarioGenerationError = signal<string | null>(null);`
- In `generateWithAi()`: 
  - At start: `this.scenarioGenerationError.set(null);`
  - In catch: `this.scenarioGenerationError.set(err instanceof Error ? err.message : 'Generation failed');`

**File:** `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.html`  
Add error display near the AI generate button (follow existing `npcGenerationError` pattern in template).

### Task 2.3 — Replace $any() with typed handler
**File:** `apps/llama-chat/src/app/chat/chat.component.ts`

Add method:
```typescript
onInput(event: Event): void {
  this.input.set((event.target as HTMLTextAreaElement).value);
}
```

**File:** `apps/llama-chat/src/app/chat/chat.component.html`  
L107: Change `(input)="input.set($any($event.target).value)"` → `(input)="onInput($event)"`

**Verification:**
```bash
npx nx run llama-chat:lint
```

---

## Phase 3: Medium — Backend Sync, localStorage Safety, Error Signal Cleanup

### Task 3.1 — _patchBackend: check response.ok + error signal
**File:** `apps/llama-chat/src/app/shared/settings.service.ts`

`_patchBackend()` at L82-88 silently ignores HTTP errors. `setActiveBackend()` at L58-62 sets `activeId` AFTER patch (correct order) but swallows failures.

- In `_patchBackend()`: after `await fetch(...)`, add:
  ```typescript
  if (!res.ok) throw new Error(`Backend switch failed: HTTP ${res.status}`);
  ```
- Add error signal: `patchError = signal<string | null>(null);`
- In `setActiveBackend()`: wrap in try-catch, set `patchError` on failure:
  ```typescript
  async setActiveBackend(id: string): Promise<void> {
    this.patchError.set(null);
    try {
      await this._patchBackend(id);
      this.activeId.set(id);
      localStorage.setItem(STORAGE_KEY, id);
    } catch (err) {
      this.patchError.set(err instanceof Error ? err.message : 'Switch failed');
    }
  }
  ```
- In `loadConfig()` at L48-50: wrap the `_patchBackend` call in try-catch (don't fail whole config load if sync fails)

### Task 3.2 — Guard localStorage writes in dm.component.ts
**File:** `apps/llama-chat/src/app/dm/dm.component.ts`

4 unguarded write sites: L199 (`saveQuest`), L208 (`deleteQuest`), L351 (`saveNpc`), L360 (`deleteNpc`). Private browsing throws `SecurityError`.

- Add private helper method:
  ```typescript
  private saveToStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota / private browsing */ }
  }
  ```
- Replace all 4 write sites with `this.saveToStorage(STORAGE_KEY_QUESTS, updated)` / `this.saveToStorage(STORAGE_KEY_NPCS, updated)`

### Task 3.3 — Clear error signals on retry in dm.component.ts
**File:** `apps/llama-chat/src/app/dm/dm.component.ts`

- `generateQuest()` at L56: add `this.questError.set(null);` as first line inside the method body (before `this.generatingQuest.set(true)`)
- `generateNpc()` at L222: add `this.npcError.set(null);` as first line

**Verification:**
```bash
npx nx test llama-chat
```

---

## Phase 4: Low — Cleanup

### Task 4.1 — Migrate error-boundary.component.ts to @if
**File:** `apps/llama-chat/src/app/shared/error-boundary.component.ts`

Template at L6-15 uses `*ngIf` with `ng-template`. Migrate to new control flow:

```typescript
template: `
  @if (!error()) {
    <ng-content />
  } @else {
    <div class="error-boundary">
      <h3>Something went wrong</h3>
      <p>{{ error()?.message }}</p>
      <button (click)="reset()">Try again</button>
    </div>
  }
`,
```

Remove `CommonModule` from imports array if present (check — currently only imports `Component, signal` from `@angular/core`, no `CommonModule`).

### Task 4.2 — Remove unused trackByIdx from dm.component.ts
**File:** `apps/llama-chat/src/app/dm/dm.component.ts`

Delete method at L384:
```typescript
trackByIdx(_: number, __: unknown): number
```

Verify it's not referenced in `dm.component.html` before deleting.

### Task 4.3 — Add redirect for invalid route param in scenario-form (optional enhancement)
**File:** `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.ts`

Constructor at L55-60 already has type guard (`if (mode === 'adventure' || mode === 'interpersonal')`). Enhancement: add explicit redirect when mode is invalid:

```typescript
const mode = this.route.snapshot.paramMap.get('mode');
if (mode !== 'adventure' && mode !== 'interpersonal') {
  this.router.navigate(['/']);
  return;
}
this.scenarioType.set(mode);
```

**Verification (all phases):**
```bash
npx nx run-many -t lint test --projects=llama-chat
npx nx serve llama-chat  # manual smoke test: send message, DM tab, settings
```

---

## Execution Order

| Phase | Tasks | Risk | Estimated changes |
|-------|-------|------|-------------------|
| 1 | 1.1, 1.2, 1.3 | Medium — core streaming + sanitizer | ~20 lines |
| 2 | 2.1, 2.2, 2.3 | Low — additive | ~25 lines |
| 3 | 3.1, 3.2, 3.3 | Low — additive + refactor | ~30 lines |
| 4 | 4.1, 4.2, 4.3 | Low — cleanup | ~15 lines |

Each phase is self-contained and can be executed in a fresh context using this document as reference.
