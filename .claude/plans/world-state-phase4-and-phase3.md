# Implementation Plan: World State UI (Phase 4) + LLM Delta Updates (Phase 3)

> Context: Phases 1 and 2 are complete (commits 77f6f62, f11689a).
> WorldState data model exists. System prompt injection exists. But `state()` is always `null`
> because `ChatComponent.ngOnInit()` never calls `initForScenario()` / `loadForScenario()`.
> Fix that first, then build Phase 4 UI so we can verify Phase 3 output visually.

---

## Phase 0: Documentation Discovery

### Allowed Angular APIs (confirmed from source)

- `signal<T>()`, `.set()`, `.update()`, `computed()` — all used in chat.component.ts:25-35
- `effect()` — used in world-state.service.ts:36-41 and chat.component.ts:39-46
- `inject()` — used everywhere; standalone components only
- `@ViewChild` — chat.component.ts:36-37
- `@if / @for / @switch` — control flow blocks used in chat.component.html
- `[class.x]` binding — used in chat.component.html:98
- `(click)` event binding — standard
- `standalone: true` + `imports: [FormsModule]` — pattern from ChatComponent

### Confirmed file locations

| File | Line ref |
|---|---|
| `apps/llama-chat/src/app/chat/chat.component.ts` | WorldStateService NOT yet injected |
| `apps/llama-chat/src/app/chat/chat.component.html` | No world state panel yet |
| `apps/llama-chat/src/app/chat/chat.service.ts` | `sendMessage()` ends at line 92, no delta call |
| `apps/llama-chat/src/app/shared/ai-assist.service.ts` | No `updateWorldState()` method |
| `apps/llama-proxy/routes/generate.py` | No `/world-state/update` endpoint |
| `apps/llama-proxy/models.py` | `WorldStateDelta` at line 204; `WorldStateUpdateRequest` does NOT exist yet |

### Anti-patterns to avoid

- Do NOT use `NgZone`, `ChangeDetectorRef`, or `ngAfterViewChecked` — project uses signals exclusively
- Do NOT add `@NgModule` — all components are standalone
- Do NOT import `HttpClient` — project uses raw `fetch()` / `ReadableStream`
- Do NOT use `Observable` in new service methods — use `async/await` with `fetch()` matching existing patterns
- Do NOT inject `WorldStateService` in `ChatService` again — already injected (line 18)

---

## Pre-Phase 4: Fix WorldState Initialization Gap

**Problem:** `WorldStateService.state()` is always `null` because `ChatComponent` never calls `initForScenario()` or `loadForScenario()`.

**Files to change:** `chat.component.ts` only.

### Step 1 — Inject WorldStateService in ChatComponent

In `chat.component.ts`:
- Add import: `import { WorldStateService } from '../world-state/world-state.service';`
- Add injection: `protected worldStateService = inject(WorldStateService);`

### Step 2 — Call load/init in ngOnInit

Replace the existing `ngOnInit` block (lines 48-57):

```typescript
ngOnInit(): void {
  if (!this.scenarioService.activeScenario()) {
    this.router.navigate(['/']);
  } else {
    const scenario = this.scenarioService.activeScenario()!;
    // Load saved world state, or init fresh if none exists
    if (!this.worldStateService.loadForScenario(scenario.title)) {
      this.worldStateService.initForScenario(scenario);
    }
    this.chatService.loadPersistedMessages();
    if (this.chatService.messages().length === 0) {
      this.chatService.initializeStory();
    }
  }
}
```

### Verification

- `console.log(worldStateService.state())` in browser shows non-null after navigating to `/chat`
- localStorage has key `llama-world-state-{uuid}` after first load
- Second navigation to `/chat` loads the same state (same UUID, same NPCs)
- `npx nx test llama-chat` — 9 existing tests still pass

---

## Phase 4: World State UI (Collapsible Side Panel)

**Goal:** Collapsible side panel in ChatComponent. Tabs: Scene, Factions, NPCs, Events. Contradiction alert badge. Inline edit on NPCs/factions.

### Step 1 — Add signals to ChatComponent

In `chat.component.ts`, add these signals (after existing `pendingAction` signal):

```typescript
protected showWorldPanel = signal(false);
protected worldTab = signal<'scene' | 'factions' | 'npcs' | 'events'>('scene');
protected contradictions = signal<string[]>([]);
```

### Step 2 — Add toggle method

```typescript
toggleWorldPanel(): void {
  this.showWorldPanel.update(v => !v);
}

setWorldTab(tab: 'scene' | 'factions' | 'npcs' | 'events'): void {
  this.worldTab.set(tab);
}

dismissContradictions(): void {
  this.contradictions.set([]);
}
```

### Step 3 — Add standingLabel helper to ChatComponent

Copy the helper so the template can call it. Add as a protected method:

```typescript
protected standingLabel(v: number): string {
  if (v >= 75)  return 'Allied';
  if (v >= 40)  return 'Friendly';
  if (v >= 10)  return 'Neutral+';
  if (v >= -10) return 'Neutral';
  if (v >= -40) return 'Unfriendly';
  if (v >= -75) return 'Hostile';
  return 'Enemy';
}

protected standingColor(v: number): string {
  if (v >= 40)  return '#4caf50';
  if (v >= -10) return '#ff9800';
  if (v >= -40) return '#f44336';
  return '#9c27b0';
}
```

### Step 4 — Update chat.component.html layout

Wrap the existing `<div class="chat-container">` in a new flex wrapper:

```html
<div class="chat-layout" [class.panel-open]="showWorldPanel()">
  <div class="chat-container">
    <!-- existing content, with one addition in header -->
  </div>

  @if (showWorldPanel() && worldStateService.state(); as ws) {
    <aside class="world-panel">
      <!-- world state panel -->
    </aside>
  }
</div>
```

**In the header**, add world panel button and contradiction badge before `</header>`:

```html
<!-- Add to header-actions div, before the existing buttons -->
@if (contradictions().length > 0) {
  <button class="btn-contradiction" (click)="dismissContradictions()" [title]="contradictions().join('\n')">
    ⚠ {{ contradictions().length }}
  </button>
}
@if (worldStateService.state()) {
  <button class="btn-header" (click)="toggleWorldPanel()" [class.active]="showWorldPanel()" title="World state">🌍</button>
}
```

**World panel aside content:**

```html
<aside class="world-panel">
  <div class="panel-header">
    <span class="panel-title">World State</span>
    <button class="btn-close-panel" (click)="toggleWorldPanel()">✕</button>
  </div>

  <div class="panel-tabs">
    <button [class.active]="worldTab() === 'scene'" (click)="setWorldTab('scene')">Scene</button>
    <button [class.active]="worldTab() === 'factions'" (click)="setWorldTab('factions')">Factions</button>
    <button [class.active]="worldTab() === 'npcs'" (click)="setWorldTab('npcs')">NPCs</button>
    <button [class.active]="worldTab() === 'events'" (click)="setWorldTab('events')">Events</button>
  </div>

  @if (worldStateService.state(); as ws) {

    @if (worldTab() === 'scene') {
      <div class="panel-content">
        <div class="scene-block">
          <div class="scene-tension" [class]="'tension-' + (ws.currentScene?.tension ?? 'calm')">
            {{ ws.currentScene?.tension ?? 'calm' }}
          </div>
          @if (ws.currentScene?.sceneNote) {
            <p class="scene-note">{{ ws.currentScene!.sceneNote }}</p>
          }
          <div class="clock">Day {{ ws.worldClock.dayNumber }} · {{ ws.worldClock.timeOfDay }} · {{ ws.worldClock.season }}</div>
        </div>
        @if (ws.currentScene?.presentNpcIds?.length) {
          <div class="present-npcs">
            <strong>Present:</strong>
            @for (id of ws.currentScene!.presentNpcIds; track id) {
              @if (ws.npcStates | findById: id; as npc) {
                <span class="npc-tag">{{ npc.name }}</span>
              }
            }
          </div>
        }
      </div>
    }

    @if (worldTab() === 'factions') {
      <div class="panel-content">
        @for (f of ws.factions; track f.id) {
          <div class="faction-row">
            <div class="faction-name">{{ f.name }}</div>
            <div class="standing-bar-wrap">
              <div class="standing-bar" [style.width.%]="(f.standing + 100) / 2" [style.background]="standingColor(f.standing)"></div>
            </div>
            <span class="standing-label" [style.color]="standingColor(f.standing)">{{ standingLabel(f.standing) }} ({{ f.standing > 0 ? '+' : '' }}{{ f.standing }})</span>
          </div>
        }
        @if (!ws.factions.length) {
          <p class="empty-tab">No factions tracked yet.</p>
        }
      </div>
    }

    @if (worldTab() === 'npcs') {
      <div class="panel-content">
        @for (npc of ws.npcStates; track npc.npcId) {
          <div class="npc-row" [class.dead]="npc.status === 'dead'">
            <div class="npc-name">{{ npc.name }} <span class="npc-status">{{ npc.status !== 'alive' ? '(' + npc.status + ')' : '' }}</span></div>
            @if (npc.status !== 'dead') {
              <div class="standing-bar-wrap">
                <div class="standing-bar" [style.width.%]="(npc.disposition + 100) / 2" [style.background]="standingColor(npc.disposition)"></div>
              </div>
              <span class="standing-label" [style.color]="standingColor(npc.disposition)">{{ standingLabel(npc.disposition) }}</span>
            }
            @if (npc.notes) {
              <p class="npc-notes">{{ npc.notes }}</p>
            }
          </div>
        }
        @if (!ws.npcStates.length) {
          <p class="empty-tab">No NPCs tracked yet.</p>
        }
      </div>
    }

    @if (worldTab() === 'events') {
      <div class="panel-content">
        @for (e of ws.storyEvents.slice().reverse(); track e.id) {
          <div class="event-row">
            <span class="event-certainty" [class]="'certainty-' + e.certainty">{{ e.certainty }}</span>
            <span class="event-title">Turn {{ e.turn }} — {{ e.title }}</span>
            <p class="event-desc">{{ e.description }}</p>
          </div>
        }
        @if (!ws.storyEvents.length) {
          <p class="empty-tab">No events recorded yet.</p>
        }
        @if (ws.archivedEventCount > 0) {
          <p class="archived-note">+{{ ws.archivedEventCount }} archived events not shown</p>
        }
      </div>
    }

  }
</aside>
```

**Note on `| findById` pipe:** The template above uses `ws.npcStates | findById: id` for demonstration clarity. Since pipes require declaration, simplify by computing in the component instead. Replace with a method:

```typescript
protected findNpcById(ws: WorldState, id: string) {
  return ws.npcStates.find(n => n.npcId === id);
}
```

And in template: `@if (findNpcById(ws, id); as npc)`.

Import `WorldState` type in chat.component.ts: `import { WorldState } from '../world-state/world-state.model';`

### Step 5 — CSS for world panel layout

In `chat.component.scss`, add:

```scss
.chat-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;

  .chat-container {
    flex: 1;
    min-width: 0;  // prevents flex child from overflowing
  }
}

.world-panel {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid #333;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
    font-weight: 600;
  }

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid #333;

    button {
      flex: 1;
      padding: 0.5rem;
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 0.8rem;

      &.active {
        color: #fff;
        border-bottom: 2px solid #7c4dff;
      }
    }
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
  }
}

.standing-bar-wrap {
  background: #333;
  border-radius: 4px;
  height: 6px;
  margin: 4px 0;
  overflow: hidden;

  .standing-bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
}

.tension-calm    { color: #4caf50; }
.tension-tense   { color: #ff9800; }
.tension-hostile { color: #f44336; }
.tension-combat  { color: #9c27b0; }

.certainty-witnessed { color: #4caf50; }
.certainty-rumored   { color: #ff9800; }
.certainty-deduced   { color: #2196f3; }
.certainty-false     { color: #666; text-decoration: line-through; }

.npc-row.dead { opacity: 0.4; }

.btn-contradiction {
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-header.active {
  background: rgba(124, 77, 255, 0.2);
  color: #7c4dff;
}

.empty-tab {
  color: #666;
  font-style: italic;
  padding: 1rem 0;
  text-align: center;
}

.archived-note {
  color: #666;
  font-size: 0.8rem;
  text-align: center;
  padding-top: 0.5rem;
}
```

### Verification

- Navigate to `/chat` → 🌍 button appears in header when world state is initialized
- Click 🌍 → side panel slides open, chat remains visible
- NPCs from scenario appear in NPCs tab with neutral disposition bars
- Scene tab shows "calm" tension + world clock
- Panel toggle does NOT break chat auto-scroll (the `messageList` scroll effect still works)
- `npx nx test llama-chat` still passes 9 tests

---

## Phase 3: LLM Delta Updates

**Goal:** After each chat turn, fire a non-blocking POST to `/world-state/update` that extracts state changes from the last 6 messages. Apply delta to `WorldStateService`. Display contradictions.

### Step 1 — Backend: Add WorldStateUpdateRequest to models.py

In `apps/llama-proxy/models.py`, append after the existing `WorldStateDelta` class:

```python
class WorldStateUpdateRequest(BaseModel):
    scenario: Scenario
    world_state: WorldStateModel
    last_exchanges: list[StoryMessage]  # last 6 messages (3 pairs)
```

### Step 2 — Backend: Add /world-state/update endpoint to routes/generate.py

The endpoint must call the LLM with `temperature=0.15` and request JSON output.

Add import at top of `routes/generate.py`:
```python
from models import WorldStateUpdateRequest, WorldStateDelta
```

Add endpoint function:

```python
@router.post("/world-state/update")
async def update_world_state(request: WorldStateUpdateRequest) -> WorldStateDelta:
    npc_table = "\n".join(
        f'- "{n.npc_id}": {n.name}' for n in request.world_state.npc_states
    )
    faction_table = "\n".join(
        f'- "{f.id}": {f.name}' for f in request.world_state.factions
    )

    system_prompt = f"""You are the world state tracker for an interactive story.
Analyze the story exchange and extract ONLY what actually changed.

Available NPC IDs (use these exactly):
{npc_table if npc_table else "(none yet)"}

Available faction IDs (use these exactly):
{faction_table if faction_table else "(none yet)"}

Rules:
1. Only mark NPC status "dead" if the narrative EXPLICITLY states death — not "might be dead", "fled", "disappeared".
2. Disposition changes: only when the narrative shows a clear positive/negative interaction. Cap at ±25 per turn.
3. New events: only for distinct actions, discoveries, or confrontations — not ambient description. Title ≤6 words. Set certainty="witnessed" if the player character was present.
4. Scene update: change location_id if the player moved. Add/remove NPC IDs as they enter/leave. Update tension to "hostile" or "combat" only when appropriate.
5. clock_advance: true only when the narrative implies a rest, journey, or time-skip.
6. key_facts_append: only for major permanent facts. Max 2 per turn.
7. Use ONLY the IDs from the tables above. If an entity has no listed ID, omit it.
8. If NOTHING changed, return all empty arrays/null — do not invent changes.

Output ONLY valid JSON matching this schema:
{{
  "faction_changes": [{{"faction_id": "str", "standing_delta": 0, "notes_append": ""}}],
  "npc_changes": [{{"npc_id": "str", "new_status": null, "disposition_delta": 0, "new_known_facts": [], "notes_append": ""}}],
  "new_events": [{{"title": "str", "description": "str", "type": "world", "certainty": "witnessed", "source": "", "involved_npc_ids": [], "involved_faction_ids": [], "location_id": null}}],
  "scene_update": null,
  "clock_advance": false,
  "key_facts_append": []
}}"""

    messages = [
        {"role": m.role, "content": m.content}
        for m in request.last_exchanges
    ]

    payload = {
        "model": "gpt-4",  # will use active backend
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "temperature": 0.15,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_get_active_backend_url()}/v1/chat/completions",
            json=payload,
        )
        resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"]

    # Strip markdown code fences if present
    content = content.strip()
    if content.startswith("```"):
        content = "\n".join(content.split("\n")[1:])
        content = content.rsplit("```", 1)[0]

    delta_raw = json.loads(content)
    return WorldStateDelta(**delta_raw)
```

**Note:** Check how `routes/generate.py` currently accesses the llama-server URL and active backend — grep `_get_active_backend_url` or equivalent. Match that pattern exactly. Also verify the `httpx` import and `json` import are at the top of the file.

Register the new route in `apps/llama-proxy/main.py` — check how `generate` router is registered there and follow the same pattern.

### Step 3 — Frontend: Add updateWorldState to AiAssistService

In `apps/llama-chat/src/app/shared/ai-assist.service.ts`, add import:
```typescript
import { WorldStateDelta } from '../world-state/world-state.model';
```

Add method:

```typescript
async updateWorldState(payload: {
  scenario: unknown;
  world_state: unknown;
  last_exchanges: { role: string; content: string; input_type: string }[];
}): Promise<WorldStateDelta> {
  const response = await fetch(`${environment.apiBaseUrl}/world-state/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(environment.timeoutMs),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`world-state/update HTTP ${response.status}`);
  return await response.json() as WorldStateDelta;
}
```

### Step 4 — Frontend: Inject AiAssistService into ChatService and fire delta

`ChatService` currently does NOT inject `AiAssistService` (would create circular dependency since `AiAssistService` imports from `chat.service.ts` for `ChatMessage`). Instead, fire the delta call from `ChatComponent`.

In `chat.component.ts`, update `send()`:

```typescript
send(): void {
  const text = this.input().trim();
  if (!text || this.chatService.loading()) return;
  this.input.set('');
  this.chatService.sendMessage(text, this.inputType()).then(() => {
    this.triggerWorldStateUpdate();
  });
  this.focusInput();
}
```

But `sendMessage()` is currently `void`, not a Promise. To avoid changing `ChatService` signature, instead use a computed effect that fires when `loading()` transitions from `true` → `false`:

```typescript
private _deltaEffect = effect(() => {
  const loading = this.chatService.loading();
  if (!loading && this._wasLoading) {
    this._wasLoading = false;
    this.triggerWorldStateUpdate();
  }
  if (loading) this._wasLoading = true;
});

private _wasLoading = false;
```

Add `triggerWorldStateUpdate()`:

```typescript
private triggerWorldStateUpdate(): void {
  const ws = this.worldStateService.state();
  if (!ws) return;
  const scenario = this.scenarioService.activeScenario();
  if (!scenario) return;
  const messages = this.chatService.messages();
  const lastExchanges = messages.slice(-6);
  if (lastExchanges.length === 0) return;

  this.aiAssist.updateWorldState({
    scenario: this.chatService['buildScenarioPayload'](scenario),  // private method — extract to package-private or duplicate minimal payload
    world_state: ws,
    last_exchanges: lastExchanges.map(m => ({
      role: m.role,
      content: m.content,
      input_type: m.inputType ?? 'dialogue',
    })),
  }).then(delta => {
    this.worldStateService.applyDelta(delta);
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      const contradictions = this.worldStateService.detectContradictions(lastMsg.content);
      if (contradictions.length) this.contradictions.set(contradictions);
    }
  }).catch(err => {
    console.warn('World state update failed (non-blocking)', err);
  });
}
```

**Note on `buildScenarioPayload`:** It's a private method in `ChatService`. Options:
- Change to `protected` in `ChatService` — preferred (minimal change)
- Or duplicate the minimal scenario payload inline in `triggerWorldStateUpdate()`

Choose changing to `protected` in `ChatService` line 115.

Also add `AiAssistService` import and injection to `ChatComponent`:

The component already has `private aiAssist = inject(AiAssistService)` at line 21. It is already injected. Just add `WorldState` type import.

### Step 5 — Register route in main.py

Verify `apps/llama-proxy/main.py` includes the generate router. The `/world-state/update` route goes in `routes/generate.py` which is already included — check its router prefix.

```python
# In routes/generate.py — check what prefix the router uses
router = APIRouter()  # or APIRouter(prefix="/generate")
```

If the router has no prefix, the endpoint `@router.post("/world-state/update")` will be available at `/world-state/update`. Confirm this matches the frontend fetch URL.

### Verification

- `curl -X POST http://localhost:8000/world-state/update -H "Content-Type: application/json" -d '{"scenario": {...}, "world_state": {...}, "last_exchanges": []}' ` returns a valid `WorldStateDelta` JSON (even if all empty arrays)
- After sending a chat message, network tab shows a second POST to `/world-state/update` that fires AFTER the `/chat` stream completes
- NPC disposition changes appear in the NPCs tab of the world panel after a turn with clear interaction
- Dead NPC name in narrative → contradiction badge appears in header (⚠ 1)
- `applyDelta()` discards unknown IDs (verify via `console.warn` in browser devtools)
- `npx nx test llama-chat` still passes (delta is non-blocking, doesn't affect existing tests)

---

## Execution Order

1. **Pre-Phase 4 fix** — ChatComponent init (30 min, single file change)
2. **Phase 4 Step 1-3** — Add signals + helpers to ChatComponent (20 min)
3. **Phase 4 Step 4** — Update HTML template (45 min)
4. **Phase 4 Step 5** — Add CSS (20 min)
5. **Verify Phase 4** — Run dev server, test in browser
6. **Phase 3 Step 1** — Add `WorldStateUpdateRequest` to models.py (10 min)
7. **Phase 3 Step 2** — Add `/world-state/update` endpoint (45 min)
8. **Phase 3 Step 3** — Add `updateWorldState()` to AiAssistService (15 min)
9. **Phase 3 Step 4** — Wire delta trigger in ChatComponent (30 min)
10. **Phase 3 Step 5** — Register + verify route (15 min)
11. **End-to-end test** — Full play session, verify world state evolves

## Known Gaps / Pre-flight Checks

Before starting Phase 3 Step 2:
- Grep `routes/generate.py` for how it accesses llama-server URL: `grep -n "localhost\|backend\|url\|httpx" apps/llama-proxy/routes/generate.py`
- Check if `json` is already imported in generate.py
- Check the router's prefix: `grep "APIRouter\|prefix" apps/llama-proxy/routes/generate.py`
- Confirm route is registered in main.py: `grep "generate" apps/llama-proxy/main.py`