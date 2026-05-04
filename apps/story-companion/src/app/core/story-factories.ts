import type { ScenarioDto } from '@nx-monorepo-experiment/shared-api-contracts';
import type { ProviderMode, StorySession, StoryWorldState } from './story-types';

export function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeDefaultScenario(): ScenarioDto {
  return {
    scenario_type: 'adventure',
    title: 'Untitled Story',
    setting: 'A place waiting to be defined.',
    tone: 'balanced',
    character_name: 'The Wanderer',
    character_description: 'A protagonist at the edge of a decision.',
    npcs: [],
    rules: [],
  };
}

export function makeEmptyWorldState(id: string, scenarioTitle: string, scenario?: ScenarioDto): StoryWorldState {
  return {
    id,
    scenario_title: scenarioTitle,
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
    npcStates: (scenario?.npcs ?? []).map((npc) => ({
      npcId: npc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: npc.name,
      status: 'alive',
      disposition: 0,
    })),
    events: [],
    questLog: [],
    sessionSummaries: [],
    ambientInject: null,
    npcRumors: [],
    playerCharacter: scenario ? {
      name: scenario.character_name,
      description: scenario.character_description,
    } : undefined,
    storyBeat: null,
    combat: null,
  };
}

export function makeStorySession(patch: Partial<StorySession> = {}): StorySession {
  const scenario = patch.scenario ?? makeDefaultScenario();
  const timestamp = nowIso();
  const id = patch.id ?? newId('session');

  return {
    id,
    title: patch.title ?? scenario.title,
    providerMode: patch.providerMode ?? 'local',
    scenario,
    messages: patch.messages ?? [],
    worldState: patch.worldState ?? makeEmptyWorldState(newId('world'), scenario.title, scenario),
    createdAt: patch.createdAt ?? timestamp,
    updatedAt: patch.updatedAt ?? timestamp,
  };
}

export function makeUserMessage(content: string, inputType: 'dialogue' | 'action' | 'direct' | 'remember') {
  return {
    id: newId('message'),
    role: 'user' as const,
    content,
    input_type: inputType,
    createdAt: nowIso(),
  };
}

export function makeAssistantMessage(content = '') {
  return {
    id: newId('message'),
    role: 'assistant' as const,
    content,
    input_type: 'dialogue' as const,
    createdAt: nowIso(),
  };
}

export function providerLabel(mode: ProviderMode): string {
  return mode === 'local' ? 'Local' : 'OpenRouter';
}
