import { Injectable, effect, inject, signal } from '@angular/core';
import {
  AmbientEvent,
  CurrentScene,
  Faction,
  NpcState,
  QuestEntry,
  RelationshipTier,
  SceneTension,
  SessionSummary,
  StoryBeat,
  StoryEvent,
  TimeOfDay,
  WorldState,
  WorldStateDelta,
} from './world-state.model';
import { Scenario } from '../scenario/scenario.model';
import { StorageService } from '../shared/storage.service';

const CURRENT_SCHEMA_VERSION = 3;
const MAX_HOT_EVENTS = 50;
const MAX_KEY_FACTS = 10;
const STORAGE_KEY_PREFIX = 'llama-world-state-';
const WORLD_INDEX_KEY = 'llama-world-index';

type WorldIndex = { id: string; title: string; lastUpdated: string }[];
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
  private storageService = inject(StorageService);
  readonly state = signal<WorldState | null>(null);

  constructor() {
    // effect() — single write path for all mutations except applyDelta()
    // fires asynchronously after any signal change
    effect(() => {
      const current = this.state();
      if (current) {
        this.persistNow(current).catch(err =>
          console.warn('WorldStateService: async persist failed', err)
        );
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
      questLog: [],
      playerCharacter: null,
      choiceChronicle: [],
      storyBeat: null,
      ambientQueue: [],
      bondState: scenario.scenarioType === 'interpersonal'
        ? { tier: 0, temperature: 'warm', memoryAnchors: [], milestones: [], companionMood: '' }
        : null,
    };

    this.state.set(newState);
  }

  async loadForScenario(scenarioTitle: string): Promise<boolean> {
    try {
      const index = await this.storageService.load<WorldIndex>(WORLD_INDEX_KEY);
      if (index) {
        const entry = index.find(e => e.title === scenarioTitle);
        if (entry) {
          const parsed = await this.storageService.load<Partial<WorldState>>(
            `${STORAGE_KEY_PREFIX}${entry.id}`
          );
          if (parsed) {
            this.state.set(this.migrate(parsed));
            return true;
          }
        }
      }
    } catch { /* fall through */ }

    // Fallback: linear scan via prefix
    try {
      const keys = await this.storageService.listByPrefix(STORAGE_KEY_PREFIX);
      for (const key of keys) {
        const parsed = await this.storageService.load<Partial<WorldState>>(key);
        if (parsed?.scenarioTitle === scenarioTitle) {
          this.state.set(this.migrate(parsed));
          return true;
        }
      }
    } catch { /* give up */ }

    return false;
  }

  applyDelta(delta: WorldStateDelta): void {
    const s = this.state();
    if (!s) return;

    const knownNpcIds = new Set(s.npcStates.map(n => n.npcId));
    const knownFactionIds = new Set(s.factions.map(f => f.id));

    // Merge factionDrift into factionChanges (Phase 3a heartbeat)
    const allFactionChanges = [...delta.factionChanges, ...(delta.factionDrift ?? [])];

    const validFactionChanges = allFactionChanges.filter(c => {
      const valid = knownFactionIds.has(c.factionId);
      if (!valid) console.warn(`WorldStateDelta: unknown factionId "${c.factionId}" discarded`);
      return valid;
    });

    const validNpcChanges = delta.npcChanges.filter(c => {
      const valid = knownNpcIds.has(c.npcId);
      if (!valid) console.warn(`WorldStateDelta: unknown npcId "${c.npcId}" discarded`);
      return valid;
    });

    // Merge npcRumors into newEvents (Phase 3a heartbeat)
    const allNewEvents = [...delta.newEvents, ...(delta.npcRumors ?? [])];

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
        const timeOrder: TimeOfDay[] = ['dawn', 'morning', 'afternoon', 'evening', 'night'];
        let totalTurns = delta.clockAdvance.turns;
        let timeIdx = timeOrder.indexOf(worldClock.timeOfDay);
        let dayNumber = worldClock.dayNumber;
        while (totalTurns > 0) {
          timeIdx++;
          totalTurns--;
          if (timeIdx >= timeOrder.length) {
            timeIdx = 0;
            dayNumber++;
          }
        }
        worldClock = { ...worldClock, dayNumber, timeOfDay: timeOrder[timeIdx] };
      }

      // Append key facts (capped)
      const keyFacts = [...current.keyFacts, ...delta.keyFactsAppend].slice(0, MAX_KEY_FACTS);

      // Add new events with IDs and cap at MAX_HOT_EVENTS (includes npcRumors merged above)
      let turn = current.turnCount;
      const newEvents: StoryEvent[] = allNewEvents.map(e => ({
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

      // Apply quest updates
      const questLog = current.questLog.map(q => {
        const update = delta.questUpdates.find(u => u.questId === q.id);
        if (!update) return q;
        const objectivesDone = update.objectivesDone;
        const objectives = objectivesDone
          ? q.objectives.map((o, i) => objectivesDone.includes(i) ? { ...o, done: true } : o)
          : q.objectives;
        return {
          ...q,
          status: update.newStatus ?? q.status,
          objectives,
          resolvedAtTurn: update.newStatus && update.newStatus !== 'active' ? current.turnCount : q.resolvedAtTurn,
        };
      });

      // Apply player update
      let playerCharacter = current.playerCharacter;
      if (delta.playerUpdate && playerCharacter) {
        const pu = delta.playerUpdate;
        const newHp = pu.hpDelta
          ? { ...playerCharacter.hp, current: Math.max(0, Math.min(playerCharacter.hp.max, playerCharacter.hp.current + pu.hpDelta)) }
          : playerCharacter.hp;
        const conditions = [
          ...playerCharacter.conditions.filter(c => !pu.conditionsRemove?.includes(c)),
          ...(pu.conditionsAdd ?? []),
        ];
        const inventory = [
          ...playerCharacter.inventory.filter(i => !pu.inventoryRemove?.includes(i)),
          ...(pu.inventoryAdd ?? []),
        ];
        playerCharacter = { ...playerCharacter, hp: newHp, conditions, inventory };
      }

      // Apply story beat
      const storyBeat: StoryBeat = delta.storyBeatUpdate !== undefined ? delta.storyBeatUpdate : current.storyBeat;

      // Phase 3a: ambient queue
      let ambientQueue = current.ambientQueue ?? [];
      if (delta.ambientInject) {
        ambientQueue = [...ambientQueue, { text: delta.ambientInject, generatedAt: new Date().toISOString() }].slice(-3);
      }

      // Phase 3d: bond update
      let bondState = current.bondState;
      if (delta.bondUpdate && bondState) {
        const bu = delta.bondUpdate;
        const newTier = Math.max(0, Math.min(5, bondState.tier + (bu.tierDelta ?? 0))) as RelationshipTier;
        const anchors = bu.newAnchor
          ? [...bondState.memoryAnchors, {
              id: crypto.randomUUID(),
              description: bu.newAnchor,
              createdAtTurn: current.turnCount,
              playerInvokedCount: 0,
            }]
          : bondState.memoryAnchors;
        bondState = {
          ...bondState,
          tier: newTier,
          temperature: bu.temperatureChange ?? bondState.temperature,
          memoryAnchors: anchors,
          milestones: bu.newMilestone ? [...bondState.milestones, bu.newMilestone] : bondState.milestones,
          companionMood: bu.companionMoodUpdate ?? bondState.companionMood,
        };
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
        questLog,
        playerCharacter,
        storyBeat,
        ambientQueue,
        bondState,
        lastUpdated: new Date().toISOString(),
      };
    });

    // Synchronous write — bypasses the async effect() write path
    const updated = this.state();
    if (updated) {
      this.persistNow(updated).catch(err =>
        console.warn('WorldStateService: applyDelta persist failed', err)
      );
    }
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

  addQuest(quest: Omit<QuestEntry, 'id' | 'addedAtTurn'>): void {
    this.state.update(s => s ? {
      ...s,
      questLog: [...s.questLog, { ...quest, id: crypto.randomUUID(), addedAtTurn: s.turnCount }],
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  updateQuestObjective(questId: string, objectiveIndex: number, done: boolean): void {
    this.state.update(s => s ? {
      ...s,
      questLog: s.questLog.map(q => q.id === questId
        ? { ...q, objectives: q.objectives.map((o, i) => i === objectiveIndex ? { ...o, done } : o) }
        : q),
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  addSessionSummary(summary: SessionSummary): void {
    this.state.update(s => {
      if (!s) return s;
      const summaries = [...s.sessionSummaries, summary];
      // Cap at 10, merge oldest two if exceeding
      const capped = summaries.length > 10 ? summaries.slice(summaries.length - 10) : summaries;
      return { ...s, sessionSummaries: capped, lastUpdated: new Date().toISOString() };
    });
  }

  exportToFile(): void {
    const state = this.state();
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-state-${state.scenarioTitle.replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<WorldState>;
      if (!parsed.id || !parsed.scenarioTitle) return false;
      const migrated = this.migrate(parsed);
      this.state.set(migrated);
      return true;
    } catch {
      return false;
    }
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
    const issues: string[] = [];

    // Dead NPC check
    for (const n of s.npcStates.filter(n => n.status === 'dead' && narrativeText.includes(n.name))) {
      issues.push(`${n.name} is dead but appeared in the narrative`);
    }

    // Phase 3e: Location contradiction heuristic
    for (const n of s.npcStates.filter(n => n.locationId && n.status !== 'dead')) {
      const assignedLoc = s.locations.find(l => l.id === n.locationId);
      if (!assignedLoc) continue;
      for (const other of s.locations.filter(l => l.id !== n.locationId)) {
        const pattern = new RegExp(
          `${n.name}[^.]{0,30}${other.name}|${other.name}[^.]{0,30}${n.name}`,
          'i',
        );
        if (pattern.test(narrativeText)) {
          issues.push(`${n.name} may be at wrong location (expected: ${assignedLoc.name})`);
          break;
        }
      }
    }

    return issues;
  }

  // Phase 3a: Consume first ambient event from queue
  consumeAmbient(): AmbientEvent | null {
    const s = this.state();
    if (!s || s.ambientQueue.length === 0) return null;
    const first = s.ambientQueue[0];
    this.state.update(current => current ? {
      ...current,
      ambientQueue: current.ambientQueue.slice(1),
      lastUpdated: new Date().toISOString(),
    } : current);
    return first;
  }

  // Phase 3b: Set story beat
  setStoryBeat(beat: WorldState['storyBeat']): void {
    this.state.update(s => s ? { ...s, storyBeat: beat, lastUpdated: new Date().toISOString() } : s);
  }

  clearState(): void {
    const s = this.state();
    if (s) {
      // Deletion is best-effort; errors are intentionally ignored
      void this.storageService.delete(`${STORAGE_KEY_PREFIX}${s.id}`);
    }
    this.state.set(null);
  }

  private async persistNow(state: WorldState): Promise<void> {
    await this.storageService.save(`${STORAGE_KEY_PREFIX}${state.id}`, state);
    // Update world index
    const index: WorldIndex = (await this.storageService.load<WorldIndex>(WORLD_INDEX_KEY)) ?? [];
    const entry = { id: state.id, title: state.scenarioTitle, lastUpdated: state.lastUpdated };
    const existingIdx = index.findIndex(e => e.id === state.id);
    if (existingIdx >= 0) {
      index[existingIdx] = entry;
    } else {
      index.push(entry);
    }
    await this.storageService.save(WORLD_INDEX_KEY, index);
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

    // v1→v2: clockAdvance changed from boolean to ClockAdvance|null in the delta type (not stored state)
    // No stored data changes needed.

    // v2→v3: add questLog, playerCharacter, choiceChronicle, storyBeat, ambientQueue, bondState
    if (version < 3) {
      raw.questLog = raw.questLog ?? [];
      raw.playerCharacter = raw.playerCharacter ?? null;
      raw.choiceChronicle = raw.choiceChronicle ?? [];
      raw.storyBeat = raw.storyBeat ?? null;
      raw.ambientQueue = raw.ambientQueue ?? [];
      raw.bondState = raw.bondState ?? null;
    }

    return {
      ...raw,
      _schemaVersion: CURRENT_SCHEMA_VERSION,
    } as WorldState;
  }
}
