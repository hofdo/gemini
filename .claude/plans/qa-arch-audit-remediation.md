# QA + Architecture Audit Remediation Plan
**Date:** 2026-04-27  
**Auditors:** QA/UX Agent + Architecture Agent  
**Overall verdict:** Solid architecture, several critical UX/gameplay gaps, no missing API endpoints, security adequate for local dev only.

---

## Phase 0: Audit Summary (Reference)

### Architecture Health
- **API contract:** 100% — all 16 frontend calls match backend endpoints exactly
- **Data models:** 92% — minor camelCase mismatch in `BondUpdate` (non-breaking due to Pydantic alias)
- **Missing endpoints:** 0 — everything called is implemented
- **Unused endpoints:** 0 — everything implemented is called
- **Concurrency:** Safe (one theoretical race in `set_backend`, low-impact)
- **Security:** Acceptable for local dev; needs auth + rate limiting for any internet exposure

### Critical Quality Issues (in priority order)
1. Combat system entirely non-functional (player character never initialized)
2. Bond state tracked but never shown to user (interpersonal mode broken UX)
3. Error retry in error-boundary doesn't actually retry
4. Form validation has no visual error feedback
5. Accessibility gaps throughout (missing ARIA, no keyboard nav on modals)
6. World state persist timing race (async effect vs page close)
7. Oracle shows empty result entries (no validation)
8. Combat initiative crashes on combatant death (index wrapping bug)

---

## Phase 1: Fix Combat System (CRITICAL — feature non-functional)

### What to implement
**Problem:** `CombatService.startCombat()` reads `worldStateService.playerCharacter` which is `null` in adventure mode (only Session Zero sets it). Result: combat initializes with no player character, state is broken from turn 1.

**Fix 1A — Auto-initialize player character from scenario**  
File: `apps/llama-chat/src/app/combat/combat.service.ts`  
When `startCombat()` is called and `playerCharacter` is null, derive a minimal player character from the active scenario's protagonist field (or a sensible default).

```typescript
// In startCombat(), before building initiative order:
const pc = this.worldStateService.playerCharacter() 
  ?? this.derivePlayerCharacterFromScenario(this.scenarioService.activeScenario());
```

**Fix 1B — Hardcoded HP**  
`combat.service.ts:56` — all NPCs spawn with `hp: { current: 15, max: 15 }`.  
Read HP from NPC stats if available:
```typescript
hp: { 
  current: npc.stats?.maxHp ?? 15, 
  max: npc.stats?.maxHp ?? 15 
}
```

**Fix 1C — Initiative index wrapping on death**  
`combat.service.ts` initiative advance — when an entity is removed from `initiativeOrder`, clamp `activeEntityIndex` to `Math.min(idx, order.length - 1)`.

**Fix 1D — Combat state cleanup on end**  
`endCombat()` sets `active: false` but stale combatants remain. Call `worldStateService.clearCombatState()` (add if missing) to reset for next encounter.

### Documentation references
- `apps/llama-chat/src/app/combat/combat.service.ts` — current implementation
- `apps/llama-chat/src/app/world-state/world-state.service.ts` — `playerCharacter` signal, combat state
- `apps/llama-chat/src/app/scenario/scenario.model.ts` — scenario fields for PC derivation

### Verification checklist
- [ ] Adventure scenario can enter combat without Session Zero being run
- [ ] NPCs spawn with stats-derived HP, not hardcoded 15
- [ ] Killing an NPC doesn't crash initiative advancement
- [ ] After `endCombat()`, navigating back to chat then re-entering combat works

### Anti-patterns
- Don't require Session Zero to be complete before combat works
- Don't silently swallow the "no player character" case — log a warning

---

## Phase 2: Bond State UI (HIGH — interpersonal mode major gap)

### What to implement
`BondState` exists in `world-state.model.ts` and is updated via `WorldStateDelta.bond_update`. It is **never displayed** anywhere in the UI.

**Fix 2A — Bond indicator in DmComponent or ChatComponent**  
For interpersonal scenarios, show a small bond meter: tier label + temperature bar.  
Location options: chat header, or sidebar panel next to scenario info.

```typescript
// In ChatComponent, compute from worldStateService:
bondState = computed(() => this.worldStateService.state()?.bondState);
isBondMode = computed(() => this.scenarioService.activeScenario()?.scenarioType === 'interpersonal');
```

Template addition in `chat.component.html`:
```html
@if (isBondMode() && bondState()) {
  <div class="bond-indicator">
    <span class="bond-tier">{{ bondState()!.tier }}</span>
    <div class="bond-bar" [style.width.%]="bondTemperaturePercent()"></div>
  </div>
}
```

**Fix 2B — Bond change feedback**  
When `WorldStateDelta` includes a `bond_update`, briefly show "+bond" or "-bond" toast notification so user knows relationship changed.

### Documentation references
- `apps/llama-chat/src/app/world-state/world-state.model.ts` — `BondState`, `BondTier`, `EmotionalTemperature`
- `apps/llama-chat/src/app/chat/chat.component.ts` — where to add computed signals
- `apps/llama-chat/src/app/world-state/world-state.service.ts` — `applyDelta()` where bond updates happen

### Verification checklist
- [ ] Bond meter visible in chat for interpersonal scenario
- [ ] Bond meter hidden for adventure scenario
- [ ] Bond updates from delta immediately reflected in UI
- [ ] Temperature bar renders correctly at min/max boundaries

---

## Phase 3: Error Handling + Reliability (HIGH)

### What to implement

**Fix 3A — Error boundary actually retries**  
`apps/llama-chat/src/app/shared/error-boundary.component.ts` — "Retry" button clears error but doesn't re-trigger the failed operation. Need to emit a retry event that parent components handle.

Pattern: Error boundary emits `(retry)` output → ChatComponent re-calls `sendMessage()` with last message.

**Fix 3B — Mid-stream error leaves orphaned message**  
`chat.service.ts:104` — message appended to signal before stream completes. If stream fails, mark message with `error: true` flag and show "Failed to generate — retry?" inline.

```typescript
// Add to ChatMessage model:
failed?: boolean;

// In stream error handler:
this.messages.update(msgs => msgs.map(m => 
  m.id === pendingId ? { ...m, failed: true } : m
));
```

**Fix 3C — Combat `resolveTurn()` returns null silently**  
`combat.service.ts:94-121` — HTTP error returns `null`, caller ignores it. Show error toast and don't advance initiative on failure.

**Fix 3D — Settings backend switch failure not shown**  
`settings.component.html` — `patchError` signal is set but never rendered. Add error display near the backend selector.

**Fix 3E — World state persist timing**  
`world-state.service.ts:49-56` — `effect()` triggers async persist but browser can close during it. Add `beforeunload` listener that calls `persistNow()` synchronously (via localStorage fallback) as last resort.

### Documentation references
- `apps/llama-chat/src/app/shared/error-boundary.component.ts` — retry mechanism
- `apps/llama-chat/src/app/chat/chat.service.ts:104, 235-241` — message append + stream error
- `apps/llama-chat/src/app/combat/combat.service.ts:94-121` — null return path
- `apps/llama-chat/src/app/shared/settings.service.ts:62-94` — patchError signal
- `apps/llama-chat/src/app/world-state/world-state.service.ts:49-56` — effect persist

### Verification checklist
- [ ] Error boundary "Retry" actually re-sends last chat message
- [ ] Failed stream leaves message with visual error indicator + retry option
- [ ] Combat resolve HTTP failure shows toast, does not advance turn
- [ ] Settings page shows inline error when backend switch fails
- [ ] World state persists via localStorage fallback on page close during indexedDB write

---

## Phase 4: Accessibility + UX Polish (HIGH)

### What to implement

**Fix 4A — Message list not announced to screen readers**  
`chat.component.html:82` — message container needs `role="log"` and `aria-live="polite"`.

**Fix 4B — Input type toggle has no text alternative**  
Emoji buttons (🗣️/⚔️/🎬) need `aria-label` attributes.

**Fix 4C — DM tabs lack ARIA roles**  
`dm.component.html:14-21` — add `role="tablist"` to container, `role="tab"` + `aria-selected` to each tab.

**Fix 4D — Modal overlays not properly modal**  
Oracle panel and combat-prompt overlay need:
- `role="dialog"` + `aria-modal="true"`
- Focus trap (Tab cycles within modal)
- Escape key handler to dismiss

**Fix 4E — Form validation visual feedback**  
`ScenarioFormComponent` — validators set but no error messages shown. Add `@if (field.invalid && field.touched)` error spans below required fields.

**Fix 4F — Confirm discard on navigation**  
`ScenarioFormComponent` — if form is dirty and user clicks back, show confirm dialog.

**Fix 4G — Oracle empty result guard**  
`chat.component.ts:290-310` — filter `data.result` before appending:
```typescript
if (data?.result?.trim()) {
  this.oracleResults.update(results => [
    { type, result: data.result, detail: data.detail },
    ...results.slice(0, 9),
  ]);
}
```

**Fix 4H — Scenario NPCs array null guard**  
`scenario.model.ts:32` and callers — guard against undefined NPCs:
```typescript
const npcs = scenario.npcs ?? [];
```
Add this anywhere NPCs are mapped/iterated.

### Verification checklist
- [ ] Screen reader announces new chat messages
- [ ] All emoji buttons have aria-label
- [ ] DM tabs keyboard-navigable with arrow keys
- [ ] Oracle and combat modals trap focus, close on Escape
- [ ] Scenario form shows validation errors inline
- [ ] Navigating back from dirty scenario form shows confirm dialog
- [ ] Oracle never shows empty result entries
- [ ] No crash when scenario has undefined npcs array

---

## Phase 5: Architecture Cleanup (MEDIUM)

### What to implement

**Fix 5A — Standardize error response envelope (backend)**  
`apps/llama-proxy/main.py:45-51` and all routes — use consistent error format:
```python
# In exception handler and all HTTPException raises:
{
  "error_type": "parse_failure | llm_unreachable | validation_error | not_found",
  "message": "human-readable description",
  "status_code": 422
}
```

**Fix 5B — BondUpdate camelCase mismatch**  
`apps/llama-chat/src/app/world-state/world-state.model.ts` — confirm TypeScript `BondUpdate` fields are correctly transformed before being sent in API payloads. Add explicit serialization test.

**Fix 5C — Race condition in set_backend**  
`apps/llama-proxy/routes/backends.py:19-27` — move lookup inside lock:
```python
async def set_backend(request: BackendPatchRequest) -> dict:
    with config._backend_lock:
        backend = next((b for b in config.BACKENDS if b["id"] == request.id), None)
        if not backend:
            raise HTTPException(status_code=404, detail=f"Backend '{request.id}' not found")
        config.active_backend = backend
    return {"active_id": backend["id"]}
```

**Fix 5D — Add pytest target to llama-proxy**  
`apps/llama-proxy/project.json` — add:
```json
"test": {
  "executor": "nx:run-commands",
  "options": {
    "command": ".venv/bin/pytest . -v --cov",
    "cwd": "apps/llama-proxy"
  }
}
```

**Fix 5E — Add Nx project tags**  
`apps/llama-chat/project.json` — add `"tags": ["scope:frontend", "lang:typescript"]`  
`apps/llm/project.json` — add `"tags": ["scope:infra", "lang:shell"]`

**Fix 5F — Add CORS methods restriction**  
`apps/llama-proxy/main.py:16-21` — change `allow_methods=["*"]` to:
```python
allow_methods=["GET", "POST", "PATCH"],
```

### Verification checklist
- [ ] All backend error responses use uniform envelope
- [ ] `set_backend` lookup is inside lock
- [ ] `npx nx test llama-proxy` target exists and runs
- [ ] All 3 projects have correct scope tags
- [ ] CORS only allows GET/POST/PATCH

---

## Phase 6: Verification

### Automated checks
```bash
# Lint + build
npx nx run-many -t lint build --parallel

# Type check
npx nx run llama-chat:type-check

# Python lint
npx nx run llama-proxy:lint

# E2E (if server running)
npx nx e2e llama-chat-e2e
```

### Manual smoke tests
1. **Adventure flow:** Menu → Adventure → fill scenario → chat → trigger combat → complete round → exit combat → resume chat
2. **Interpersonal flow:** Menu → Interpersonal → fill partner → chat → verify bond meter visible + updates
3. **DM flow:** DM → generate NPC → promote to world → generate quest → add NPC to encounter → save
4. **Settings flow:** Open settings → switch backend → verify switch confirmation → trigger error (stop proxy) → verify error shown
5. **Error recovery:** Send chat message → kill proxy mid-stream → verify error shown → restart proxy → retry → verify retry works
6. **Accessibility:** Tab through chat page, verify all interactive elements reachable; open oracle with keyboard, close with Escape

### Regression guards
- [ ] No TypeScript compile errors (`tsc --noEmit`)
- [ ] No new Ruff lint violations
- [ ] All existing scenario presets still load correctly
- [ ] World state persists across page reload (test in Firefox private + Chrome)
- [ ] Session Zero still completes end-to-end

---

## Summary Table

| Phase | Focus | Priority | Est. Effort |
|-------|-------|----------|-------------|
| 1 | Combat system (PC init, HP, initiative) | CRITICAL | Medium |
| 2 | Bond state UI display | HIGH | Small |
| 3 | Error handling + reliability | HIGH | Medium |
| 4 | Accessibility + UX polish | HIGH | Medium |
| 5 | Architecture cleanup (backend, Nx) | MEDIUM | Small |
| 6 | Verification | — | Small |