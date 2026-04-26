# Plan: Fix Angular 21 Tests

**Goal:** Fix 2 broken spec files so all tests pass under Angular 21 + Jest 30.

---

## Findings Summary

| Issue | File | Severity |
|---|---|---|
| Imports deleted `NxWelcome` component | `app.spec.ts` | Compile error |
| Tests wrong DOM content (router-only App) | `app.spec.ts` | Runtime fail |
| Uses `jasmine.createSpyObj()` in Jest project | `chat.service.spec.ts` | Runtime error |
| Signal properties mocked as spy methods | `chat.service.spec.ts` | Wrong mock shape |

**Environment:** Angular 21.1.0 · Jest 30.0.2 · jest-preset-angular 16 · Zoneless · Standalone components

---

## Allowed APIs (verified)

- `TestBed.configureTestingModule({ imports: [...], providers: [...] })`
- `TestBed.inject(Token)`
- `TestBed.createComponent(StandaloneComponent)`
- `fixture.detectChanges()` / `fixture.whenStable()`
- `signal(initialValue)` from `@angular/core` — use for mock signal properties
- `jest.fn()` — use instead of `jasmine.createSpyObj()`
- Standalone components go in `imports[]`, NOT `declarations[]`

**Anti-patterns to avoid:**
- `jasmine.createSpyObj` / `jasmine.spyOn` — Jasmine not available in Jest
- `declarations: [StandaloneComponent]` — standalone components go in `imports[]`
- `HttpClientTestingModule` — deprecated, use `provideHttpClient() + provideHttpClientTesting()`

---

## Phase 1 — Fix `app.spec.ts`

**File:** `apps/llama-chat/src/app/app.spec.ts`

**Problems:**
1. Imports `NxWelcome` from `./nx-welcome` — file deleted, causes compile error
2. Test asserts `h1` with "Welcome llama-chat" — `App` template is just `<router-outlet>`, no h1

**What to do:**
1. Remove `import { NxWelcome } from './nx-welcome'`
2. Remove `NxWelcome` from `imports: [App, NxWelcome]` → `imports: [App]`
3. Replace the "should render title" test with a "should create" smoke test:

```typescript
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
```

**Why `provideRouter([])`:** App uses `<router-outlet>` — Angular router must be provided or DI error thrown.

**Verification:** `npx nx test llama-chat --testFile=app.spec.ts` passes.

---

## Phase 2 — Fix `chat.service.spec.ts`

**File:** `apps/llama-chat/src/app/chat/chat.service.spec.ts`

**Problems:**
1. `jasmine.createSpyObj('ScenarioService', ['activeScenario'])` — Jasmine not available in Jest project; also `activeScenario` is a `WritableSignal<Scenario|null>`, not a method
2. `jasmine.createSpyObj('SettingsService', ['enableThinking'])` — same; `enableThinking` is `WritableSignal<boolean>`

**What to do — replace the two jasmine spy objects with signal-based mock objects:**

```typescript
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ChatService } from './chat.service';
import { ScenarioService } from '../scenario/scenario.service';
import { SettingsService } from '../shared/settings.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChatService,
        {
          provide: ScenarioService,
          useValue: { activeScenario: signal(null) },
        },
        {
          provide: SettingsService,
          useValue: { enableThinking: signal(false) },
        },
      ],
    });

    service = TestBed.inject(ChatService);
  });

  // All 8 existing test cases are correct — keep them unchanged:
  // 'should be created'
  // 'should reset messages'
  // 'should trim context when token limit exceeded'
  // 'should not trim context when under limit'
  // 'should estimate tokens correctly'
  // 'should show context warning when tokens exceed threshold'
  // 'should show context critical when tokens exceed critical threshold'
  // 'should cancel stream'
});
```

**Keep all 8 test bodies unchanged** — signal manipulation (`service['messages'].set(...)`, `service.messages()`) and private access patterns (`service['_abortController']`) are correct and work in Jest.

**Verification:** `npx nx test llama-chat --testFile=chat.service.spec.ts` — all 8 pass.

---

## Phase 3 — Verification

Run full test suite:

```bash
npx nx test llama-chat
```

Expected: 9 tests pass (1 from app.spec.ts + 8 from chat.service.spec.ts).

Check for:
- No `jasmine` references: `grep -r "jasmine" apps/llama-chat/src` → should return nothing
- No `NxWelcome` references: `grep -r "NxWelcome" apps/llama-chat/src` → should return nothing
- No `declarations:` in spec files: `grep -r "declarations:" apps/llama-chat/src` → should return nothing
