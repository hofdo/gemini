import type { ScenarioDto, WorldStateDeltaDto } from '@nx-monorepo-experiment/shared-api-contracts';
import { newId, nowIso } from './story-factories';
import type { StoryWorldState } from './story-types';

export function makeWorldStateForScenario(id: string, scenario: ScenarioDto): StoryWorldState {
  return {
    id,
    scenario_title: scenario.title,
    currentScene: {
      locationId: null,
      tension: 'calm',
      sceneNote: 'The story is ready to begin.',
    },
    worldClock: {
      dayNumber: 1,
      timeOfDay: 'morning',
      season: 'spring',
    },
    keyFacts: [],
    factions: [],
    npcStates: scenario.npcs.map((npc) => ({
      npcId: normalizeNpcId(npc.name),
      name: npc.name,
      status: 'alive',
      disposition: 0,
    })),
    events: [],
    questLog: [],
    sessionSummaries: [],
    ambientInject: null,
    npcRumors: [],
    playerCharacter: {
      name: scenario.character_name,
      description: scenario.character_description,
    },
    storyBeat: null,
  };
}

export function normalizeWorldState(world: StoryWorldState, scenario: ScenarioDto): StoryWorldState {
  const seed = makeWorldStateForScenario(world.id, scenario);
  return {
    ...seed,
    ...world,
    currentScene: world.currentScene ?? seed.currentScene,
    worldClock: world.worldClock ?? seed.worldClock,
    keyFacts: world.keyFacts ?? seed.keyFacts,
    factions: world.factions ?? seed.factions,
    npcStates: world.npcStates ?? seed.npcStates,
    events: world.events ?? seed.events,
    questLog: world.questLog ?? seed.questLog,
    sessionSummaries: world.sessionSummaries ?? seed.sessionSummaries,
    npcRumors: world.npcRumors ?? seed.npcRumors,
    playerCharacter: world.playerCharacter ?? seed.playerCharacter,
  };
}

export function applyWorldDelta(world: StoryWorldState, delta: WorldStateDeltaDto): StoryWorldState {
  const next: StoryWorldState = {
    ...world,
    keyFacts: mergeUnique(world.keyFacts ?? [], delta.key_facts_append ?? []),
    storyBeat: delta.story_beat_update ?? world.storyBeat ?? null,
    ambientInject: delta.ambient_inject ?? world.ambientInject ?? null,
    npcRumors: [...(world.npcRumors ?? []), ...(delta.npc_rumors ?? []).map((event) => ({
      id: event.id || newId('rumor'),
      title: event.title,
      description: event.description,
    }))],
  };

  if (delta.scene_update) {
    next.currentScene = {
      locationId: delta.scene_update.location_id ?? world.currentScene?.locationId ?? null,
      tension: delta.scene_update.new_tension ?? world.currentScene?.tension ?? 'calm',
      sceneNote: delta.scene_update.scene_note || world.currentScene?.sceneNote || '',
    };
  }

  if (delta.clock_advance) {
    const currentDay = world.worldClock?.dayNumber ?? 1;
    next.worldClock = {
      ...(world.worldClock ?? { dayNumber: 1, timeOfDay: 'morning', season: 'spring' }),
      dayNumber: currentDay + Math.max(0, delta.clock_advance.turns),
    };
  }

  const npcStates = [...(world.npcStates ?? [])];
  for (const change of delta.npc_changes ?? []) {
    const index = npcStates.findIndex((npc) => npc.npcId === change.npc_id);
    if (index === -1) continue;
    const current = npcStates[index];
    npcStates[index] = {
      ...current,
      status: change.new_status ?? current.status,
      disposition: clamp(current.disposition + change.disposition_delta, -100, 100),
    };
  }
  next.npcStates = npcStates;

  const factions = [...(world.factions ?? [])];
  for (const change of delta.faction_changes ?? []) {
    const index = factions.findIndex((faction) => faction.id === change.faction_id);
    if (index === -1) {
      factions.push({
        id: change.faction_id,
        name: change.faction_id,
        standing: clamp(change.standing_delta, -100, 100),
        notes: change.notes_append ? [change.notes_append] : [],
      });
      continue;
    }
    factions[index] = {
      ...factions[index],
      standing: clamp(factions[index].standing + change.standing_delta, -100, 100),
      notes: change.notes_append ? [...factions[index].notes, change.notes_append] : factions[index].notes,
    };
  }
  next.factions = factions;

  next.events = [...(world.events ?? []), ...(delta.new_events ?? []).map((event) => ({
    id: event.id || newId('event'),
    title: event.title,
    description: event.description,
    type: event.type,
    turn: event.turn,
  }))];

  return next;
}

export function appendSessionSummary(
  world: StoryWorldState,
  turn: number,
  summary: { summary: string; keyFacts: string[] },
): StoryWorldState {
  return {
    ...world,
    sessionSummaries: [
      ...(world.sessionSummaries ?? []),
      {
        turn,
        summary: summary.summary,
        keyFacts: summary.keyFacts,
        createdAt: nowIso(),
      },
    ],
  };
}

function mergeUnique(base: string[], additions: string[]): string[] {
  const set = new Set(base.map((entry) => entry.trim()).filter(Boolean));
  for (const value of additions) {
    const normalized = value.trim();
    if (normalized) set.add(normalized);
  }
  return Array.from(set);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeNpcId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || newId('npc');
}
