import { Injectable, effect, signal } from '@angular/core';
import {
  CurrentScene,
  Faction,
  NpcState,
  SceneTension,
  StoryEvent,
  WorldState,
  WorldStateDelta,
} from './world-state.model';
import { Scenario } from '../scenario/scenario.model';

const CURRENT_SCHEMA_VERSION = 1;
const MAX_HOT_EVENTS = 50;
const MAX_KEY_FACTS = 10;
const STORAGE_KEY_PREFIX = 'llama-world-state-';
const COMPACT_PROMPT_APPROX_CHARS_PER_TOKEN = 4;

function standingLabel(v: number): string {
  if (v >= 75)  return 'allied';
  if (v >= 40)  return 'friendly';
  if (v >= 10)  return 'neutral-positive';
  if (v >= -10) return 'neutral';
  if (v >= -40) return 'unfriendly';
  if (v >= -75) return 'hostile';
  return 'enemy';
}

@Injectable({ providedIn: 'root' })
export class WorldStateService {
  readonly state = signal<WorldState | null>(null);

  constructor() {
    // effect() — single write path for all mutations except applyDelta()
    // fires asynchronously after any signal change
    effect(() => {
      const current = this.state();
      if (current) {
        this.persistNow(current);
      }
    });
  }

  initForScenario(scenario: Scenario): void {
    const id = crypto.randomUUID();
    const npcStates: NpcState[] = scenario.npcs.map(npc => ({
      npcId: npc.name,  // use name as id since Npc has no id field
      name: npc.name,
      status: 'alive',
      disposition: 0,
      relationships: [],
      knownFacts: [],
      notes: npc.personality ?? '',
      locationId: undefined,
    }));

    const newState: WorldState = {
      _schemaVersion: CURRENT_SCHEMA_VERSION,
      id,
      scenarioTitle: scenario.title,
      currentScene: null,
      worldClock: { dayNumber: 1, timeOfDay: 'morning', season: 'spring', turnsPerDay: 8 },
      factions: [],
      locations: [],
      npcStates,
      storyEvents: [],
      archivedEventCount: 0,
      archivedEventSummary: '',
      keyFacts: [],
      sessionSummaries: [],
      turnCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    this.state.set(newState);
  }

  loadForScenario(scenarioTitle: string): boolean {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<WorldState>;
            if (parsed.scenarioTitle === scenarioTitle) {
              this.state.set(this.migrate(parsed));
              return true;
            }
          }
        } catch { /* skip malformed entries */ }
      }
    }
    return false;
  }

  applyDelta(delta: WorldStateDelta): void {
    const s = this.state();
    if (!s) return;

    const knownNpcIds = new Set(s.npcStates.map(n => n.npcId));
    const knownFactionIds = new Set(s.factions.map(f => f.id));

    const validFactionChanges = delta.factionChanges.filter(c => {
      const valid = knownFactionIds.has(c.factionId);
      if (!valid) console.warn(`WorldStateDelta: unknown factionId "${c.factionId}" discarded`);
      return valid;
    });

    const validNpcChanges = delta.npcChanges.filter(c => {
      const valid = knownNpcIds.has(c.npcId);
      if (!valid) console.warn(`WorldStateDelta: unknown npcId "${c.npcId}" discarded`);
      return valid;
    });

    this.state.update(current => {
      if (!current) return current;

      // Apply faction changes
      const factions = current.factions.map(f => {
        const change = validFactionChanges.find(c => c.factionId === f.id);
        if (!change) return f;
        const clampedDelta = Math.max(-25, Math.min(25, change.standingDelta));
        return {
          ...f,
          standing: Math.max(-100, Math.min(100, f.standing + clampedDelta)),
          notes: change.notesAppend ? `${f.notes}\n${change.notesAppend}`.trim() : f.notes,
        };
      });

      // Apply NPC changes
      const npcStates = current.npcStates.map(n => {
        const change = validNpcChanges.find(c => c.npcId === n.npcId);
        if (!change) return n;
        const clampedDelta = Math.max(-25, Math.min(25, change.dispositionDelta));
        return {
          ...n,
          status: change.newStatus ?? n.status,
          disposition: Math.max(-100, Math.min(100, n.disposition + clampedDelta)),
          knownFacts: [...n.knownFacts, ...change.newKnownFacts],
          notes: change.notesAppend ? `${n.notes}\n${change.notesAppend}`.trim() : n.notes,
        };
      });

      // Apply scene update
      let currentScene = current.currentScene;
      if (delta.sceneUpdate) {
        const su = delta.sceneUpdate;
        const base = currentScene ?? { locationId: null, presentNpcIds: [], tension: 'calm' as SceneTension, sceneNote: '' };
        const presentNpcIds = [
          ...base.presentNpcIds.filter(id => !su.removeNpcIds.includes(id)),
          ...su.addNpcIds.filter(id => !base.presentNpcIds.includes(id)),
        ];
        currentScene = {
          locationId: su.locationId !== null ? su.locationId : base.locationId,
          presentNpcIds,
          tension: su.newTension ?? base.tension,
          sceneNote: su.sceneNote || base.sceneNote,
        };
      }

      // Advance clock
      let worldClock = current.worldClock;
      if (delta.clockAdvance) {
        worldClock = { ...worldClock, dayNumber: worldClock.dayNumber + 1 };
      }

      // Append key facts (capped)
      const keyFacts = [...current.keyFacts, ...delta.keyFactsAppend].slice(0, MAX_KEY_FACTS);

      // Add new events with IDs and cap at MAX_HOT_EVENTS
      let turn = current.turnCount;
      const newEvents: StoryEvent[] = delta.newEvents.map(e => ({
        ...e,
        id: crypto.randomUUID(),
        turn: turn++,
      }));

      let storyEvents = [...current.storyEvents, ...newEvents];
      let archivedEventCount = current.archivedEventCount;
      if (storyEvents.length > MAX_HOT_EVENTS) {
        const overflow = storyEvents.length - MAX_HOT_EVENTS;
        archivedEventCount += overflow;
        storyEvents = storyEvents.slice(overflow);
      }

      return {
        ...current,
        factions,
        npcStates,
        currentScene,
        worldClock,
        keyFacts,
        storyEvents,
        archivedEventCount,
        turnCount: turn,
        lastUpdated: new Date().toISOString(),
      };
    });

    // Synchronous write — bypasses the async effect() write path
    const updated = this.state();
    if (updated) this.persistNow(updated);
  }

  updateFaction(id: string, patch: Partial<Faction>): void {
    this.state.update(s => s ? {
      ...s,
      factions: s.factions.map(f => f.id === id ? { ...f, ...patch } : f),
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  updateNpcState(id: string, patch: Partial<NpcState>): void {
    this.state.update(s => s ? {
      ...s,
      npcStates: s.npcStates.map(n => n.npcId === id ? { ...n, ...patch } : n),
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  updateScene(patch: Partial<CurrentScene>): void {
    this.state.update(s => s ? {
      ...s,
      currentScene: s.currentScene ? { ...s.currentScene, ...patch } : { locationId: null, presentNpcIds: [], tension: 'calm', sceneNote: '', ...patch },
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  addFaction(faction: Omit<Faction, 'id'>): void {
    const id = crypto.randomUUID();
    this.state.update(s => s ? {
      ...s,
      factions: [...s.factions, { ...faction, id }],
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  addNpcState(npcState: NpcState): void {
    this.state.update(s => s ? {
      ...s,
      npcStates: [...s.npcStates, npcState],
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  addEvent(event: Omit<StoryEvent, 'id' | 'turn'>): void {
    this.state.update(s => {
      if (!s) return s;
      const newEvent: StoryEvent = { ...event, id: crypto.randomUUID(), turn: s.turnCount };
      let storyEvents = [...s.storyEvents, newEvent];
      let archivedEventCount = s.archivedEventCount;
      if (storyEvents.length > MAX_HOT_EVENTS) {
        archivedEventCount += storyEvents.length - MAX_HOT_EVENTS;
        storyEvents = storyEvents.slice(storyEvents.length - MAX_HOT_EVENTS);
      }
      return { ...s, storyEvents, archivedEventCount, turnCount: s.turnCount + 1, lastUpdated: new Date().toISOString() };
    });
  }

  toCompactPrompt(maxBudget = 600): string {
    const s = this.state();
    if (!s) return '';

    const parts: string[] = [];
    let usedTokens = 0;

    const addLine = (line: string): boolean => {
      const tokens = Math.ceil(line.length / COMPACT_PROMPT_APPROX_CHARS_PER_TOKEN);
      if (usedTokens + tokens > maxBudget) return false;
      parts.push(line);
      usedTokens += tokens;
      return true;
    };

    // 1. Current scene
    if (s.currentScene) {
      const sc = s.currentScene;
      const locName = sc.locationId
        ? (s.locations.find(l => l.id === sc.locationId)?.name ?? sc.locationId)
        : 'Unknown location';
      const presentNames = sc.presentNpcIds
        .map(id => s.npcStates.find(n => n.npcId === id)?.name ?? id)
        .join(', ');
      addLine(`**Current scene:** ${locName} — ${sc.tension} — ${sc.sceneNote}`);
      if (presentNames) addLine(`Present: ${presentNames}`);
      addLine(`Time: Day ${s.worldClock.dayNumber}, ${s.worldClock.timeOfDay} (${s.worldClock.season})`);
    }

    // 2. NPCs in scene first, then remaining alive NPCs
    const sceneNpcIds = new Set(s.currentScene?.presentNpcIds ?? []);
    const aliveNpcs = s.npcStates.filter(n => n.status !== 'dead');
    const sceneNpcs = aliveNpcs.filter(n => sceneNpcIds.has(n.npcId));
    const otherNpcs = aliveNpcs.filter(n => !sceneNpcIds.has(n.npcId));

    let npcsTruncated = 0;
    for (const npc of [...sceneNpcs, ...otherNpcs]) {
      const label = standingLabel(npc.disposition);
      const line = `- ${npc.name} (${label} toward player${npc.notes ? ': ' + npc.notes.slice(0, 60) : ''})`;
      if (!addLine(line)) { npcsTruncated++; }
    }

    // 3. Factions with non-zero standing
    let factionsTruncated = 0;
    for (const f of s.factions.filter(f => f.standing !== 0)) {
      const label = standingLabel(f.standing);
      const line = `- ${f.name} (${label}, ${f.standing > 0 ? '+' : ''}${f.standing}): ${f.description.slice(0, 80)}`;
      if (!addLine(line)) { factionsTruncated++; }
    }

    // 4. Last 3 witnessed/deduced events
    const recentEvents = s.storyEvents
      .filter(e => e.certainty === 'witnessed' || e.certainty === 'deduced')
      .slice(-3);
    for (const e of recentEvents) {
      const prefix = e.certainty === 'deduced' ? 'Evidence suggests: ' : '';
      const line = `- Turn ${e.turn} — ${e.title}: ${prefix}${e.description.slice(0, 100)}`;
      addLine(line);
    }

    // 5. Truncation suffix
    const archived = s.archivedEventCount;
    if (npcsTruncated > 0 || factionsTruncated > 0 || archived > 0) {
      const parts2: string[] = [];
      if (npcsTruncated > 0) parts2.push(`+${npcsTruncated} NPCs`);
      if (factionsTruncated > 0) parts2.push(`+${factionsTruncated} factions`);
      if (archived > 0) parts2.push(`+${archived} archived events`);
      addLine(`... ${parts2.join(', ')} not shown`);
    }

    return parts.join('\n');
  }

  detectContradictions(narrativeText: string): string[] {
    const s = this.state();
    if (!s) return [];
    return s.npcStates
      .filter(n => n.status === 'dead' && narrativeText.includes(n.name))
      .map(n => `${n.name} is dead but appeared in the narrative`);
  }

  clearState(): void {
    this.state.set(null);
  }

  private persistNow(state: WorldState): void {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${state.id}`, JSON.stringify(state));
    } catch {
      // QuotaExceededError or private browsing — in-memory state still valid
    }
  }

  private migrate(raw: Partial<WorldState>): WorldState {
    const version = raw._schemaVersion ?? 0;

    if (version < 1) {
      raw.worldClock = raw.worldClock ?? { dayNumber: 1, timeOfDay: 'morning', season: 'spring', turnsPerDay: 8 };
      raw.archivedEventCount = raw.archivedEventCount ?? 0;
      raw.archivedEventSummary = raw.archivedEventSummary ?? '';
      raw.currentScene = raw.currentScene ?? null;
      raw.keyFacts = raw.keyFacts ?? [];
      raw.sessionSummaries = raw.sessionSummaries ?? [];
      raw.locations = raw.locations ?? [];
      raw.factions = raw.factions ?? [];
      raw.npcStates = raw.npcStates ?? [];
      raw.storyEvents = raw.storyEvents ?? [];
    }

    return {
      ...raw,
      _schemaVersion: CURRENT_SCHEMA_VERSION,
    } as WorldState;
  }
}
