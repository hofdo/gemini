import { Injectable, inject } from '@angular/core';
import {
  AmbientEvent,
  CombatDelta,
  CombatState,
  CurrentScene,
  Faction,
  NpcState,
  QuestEntry,
  SceneTension,
  SessionSummary,
  StoryBeat,
  StoryEvent,
  TimeOfDay,
  WorldState,
  WorldStateDelta,
} from './world-state.model';
import { Scenario } from '@nx-monorepo-experiment/shared-scenario';
import { WorldStateStore } from './world-state.store';
import { NpcStateService } from './npc-state.service';
import { QuestStateService } from './quest-state.service';
import { PlayerStateService } from './player-state.service';
import { FactionStateService } from './faction-state.service';
import { BondStateService } from './bond-state.service';
import { CombatStateService } from './combat-state.service';

const CURRENT_SCHEMA_VERSION = 3;
const MAX_HOT_EVENTS = 50;
const MAX_KEY_FACTS = 10;
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
  private store = inject(WorldStateStore);
  private npcService = inject(NpcStateService);
  private questService = inject(QuestStateService);
  private playerService = inject(PlayerStateService);
  private factionService = inject(FactionStateService);
  private bondService = inject(BondStateService);
  private combatService = inject(CombatStateService);

  get state() { return this.store.state; }

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
      combatState: null,
    };

    this.state.set(newState);
  }

  async loadForScenario(scenarioTitle: string): Promise<boolean> {
    return this.store.loadForScenario(scenarioTitle);
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

      // Apply story beat
      const storyBeat: StoryBeat = delta.storyBeatUpdate !== undefined ? delta.storyBeatUpdate : current.storyBeat;

      // Phase 3a: ambient queue
      let ambientQueue = current.ambientQueue ?? [];
      if (delta.ambientInject) {
        ambientQueue = [...ambientQueue, { text: delta.ambientInject, generatedAt: new Date().toISOString() }].slice(-3);
      }

      return {
        ...current,
        currentScene,
        worldClock,
        keyFacts,
        storyEvents,
        archivedEventCount,
        turnCount: turn,
        storyBeat,
        ambientQueue,
        lastUpdated: new Date().toISOString(),
      };
    });

    // Apply faction changes via factionService
    if (validFactionChanges.length) {
      this.factionService.applyFactionChanges(validFactionChanges);
    }

    // Apply NPC changes via npcService
    if (validNpcChanges.length) {
      this.npcService.applyNpcChanges(validNpcChanges);
    }

    // Apply quest updates via questService
    if (delta.questUpdates?.length) {
      this.questService.applyQuestUpdates(delta.questUpdates, s.turnCount);
    }

    // Apply player update via playerService
    if (delta.playerUpdate) {
      this.playerService.applyPlayerUpdate(delta.playerUpdate);
    }

    // Apply bond update via bondService
    if (delta.bondUpdate) {
      this.bondService.applyBondUpdate(delta.bondUpdate);
    }

    // Phase 5a: combat delta (applied after state.update so state() is fresh)
    if (delta.combatDelta) {
      this.combatService.applyCombatDelta(delta.combatDelta);
    }

    // Synchronous write — bypasses the async effect() write path
    const updated = this.state();
    if (updated) {
      this.store.persistNow(updated).catch(err =>
        console.warn('WorldStateService: applyDelta persist failed', err)
      );
    }
  }

  updateFaction(id: string, patch: Partial<Faction>): void {
    this.factionService.updateFaction(id, patch);
  }

  updateNpcState(id: string, patch: Partial<NpcState>): void {
    this.npcService.updateNpcState(id, patch);
  }

  updateScene(patch: Partial<CurrentScene>): void {
    this.state.update(s => s ? {
      ...s,
      currentScene: s.currentScene ? { ...s.currentScene, ...patch } : { locationId: null, presentNpcIds: [], tension: 'calm', sceneNote: '', ...patch },
      lastUpdated: new Date().toISOString(),
    } : s);
  }

  addFaction(faction: Omit<Faction, 'id'>): void {
    this.factionService.addFaction(faction);
  }

  addNpcState(npcState: NpcState): void {
    this.npcService.addNpcState(npcState);
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
    this.questService.addQuest(quest);
  }

  updateQuestObjective(questId: string, objectiveIndex: number, done: boolean): void {
    this.questService.updateQuestObjective(questId, objectiveIndex, done);
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
    this.store.exportToFile();
  }

  async importFromFile(file: File): Promise<boolean> {
    return this.store.importFromFile(file);
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

  // Phase 5a: Set combat state directly (used by CombatService)
  setCombatState(cs: CombatState | null): void {
    this.combatService.setCombatState(cs);
  }

  clearState(): void {
    this.store.clearState();
  }

  // Phase 5b: exposed for CombatService direct calls
  applyCombatDelta(delta: CombatDelta): void {
    this.combatService.applyCombatDelta(delta);
  }

}
