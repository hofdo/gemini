import { TestBed } from '@angular/core/testing';

import { StoryProviderService } from './story-provider.service';
import { StorySessionService } from './story-session.service';
import { StorySessionRepository } from './session.repository';
import { makeStorySession, makeUserMessage } from './story-factories';
import type { StorySession } from './story-types';

function setup(session: StorySession | null = null) {
  const generateScenario = jest.fn().mockResolvedValue({
    scenario_type: 'adventure',
    title: 'Ash Gate',
    setting: 'A burned city gate under black rain.',
    tone: 'tense',
    character_name: 'Mira',
    character_description: 'A watch captain with a broken oath.',
    npcs: [],
    rules: [],
  });
  const provider = {
    generateScenario,
    streamChat: jest.fn(async function* () {
      yield 'The gate groans.';
    }),
    extractWorldDelta: jest.fn().mockResolvedValue({}),
    summarizeSession: jest.fn().mockResolvedValue({ summary: '', keyFacts: [] }),
    generateOracle: jest.fn().mockResolvedValue({ oracle_type: 'npc_name', result: 'Mara', detail: '' }),
    cancelGeneration: jest.fn(),
  };
  const repository = {
    listSessions: jest.fn().mockResolvedValue(session ? [session] : []),
    saveSession: jest.fn().mockResolvedValue(undefined),
    getSession: jest.fn().mockResolvedValue(session ?? null),
    deleteSession: jest.fn().mockResolvedValue(undefined),
  };

  TestBed.configureTestingModule({
    providers: [
      StorySessionService,
      {
        provide: StoryProviderService,
        useValue: {
          forMode: jest.fn().mockReturnValue(provider),
        },
      },
      {
        provide: StorySessionRepository,
        useValue: repository,
      },
    ],
  });

  return {
    service: TestBed.inject(StorySessionService),
    provider,
    repository,
  };
}

describe('StorySessionService', () => {
  it('sends adventure as the scenario type for scenario generation', async () => {
    const { service, provider } = setup();
    await service.generateScenario('ruined fortress', 'adventure');

    expect(provider.generateScenario).toHaveBeenCalledWith({
      prompt: 'ruined fortress',
      scenarioType: 'adventure',
    });
  });

  it('exposes and executes control methods', async () => {
    const session = makeStorySession({
      messages: [
        makeUserMessage('Open the gate', 'action'),
        { ...makeUserMessage('The gate creaks.', 'dialogue'), role: 'assistant', input_type: 'dialogue' },
      ],
    });
    const { service, provider, repository } = setup(session);
    await service.loadSession(session.id);

    service.cancelGeneration();
    expect(provider.cancelGeneration).toHaveBeenCalled();

    await service.regenerateLastResponse();
    await service.retryLastResponse();
    await service.resetCurrentStory();
    await service.deleteSession(session.id);

    expect(repository.saveSession).toHaveBeenCalled();
    expect(repository.deleteSession).toHaveBeenCalledWith(session.id);
  });

  it('marks cancellation without dropping loading state immediately', async () => {
    const session = makeStorySession();
    const { service, provider } = setup(session);
    await service.loadSession(session.id);
    service.loading.set(true);

    service.cancelGeneration();

    expect(provider.cancelGeneration).toHaveBeenCalled();
    expect(service.loading()).toBe(true);
  });

  it('maps oracle request fields from the active session', async () => {
    const session = makeStorySession({
      worldState: {
        ...makeStorySession().worldState,
        keyFacts: ['Gate is barred', 'Captain is missing'],
      },
    });
    const { service, provider } = setup(session);
    await service.loadSession(session.id);

    await service.generateOracle('quest_hook');

    expect(provider.generateOracle).toHaveBeenCalledWith(expect.objectContaining({
      oracleType: 'quest_hook',
      scenarioTitle: session.scenario.title,
      setting: session.scenario.setting,
      worldStateSummary: expect.stringContaining('Gate is barred'),
    }));
  });

  it('normalizes undefined worldState arrays when loading a legacy session', async () => {
    const session = makeStorySession({
      worldState: {
        id: 'world-legacy',
        scenario_title: 'Old Session',
        // Intentionally omit all optional array fields to simulate legacy storage
      },
    });
    const { service } = setup(session);

    const loaded = await service.loadSession(session.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.worldState.factions).toBeDefined();
    expect(loaded!.worldState.events).toBeDefined();
    expect(loaded!.worldState.keyFacts).toBeDefined();
    expect(loaded!.worldState.npcStates).toBeDefined();
    expect(loaded!.worldState.questLog).toBeDefined();
    expect(loaded!.worldState.sessionSummaries).toBeDefined();
    expect(loaded!.worldState.npcRumors).toBeDefined();
    expect(Array.isArray(loaded!.worldState.factions)).toBe(true);
    expect(Array.isArray(loaded!.worldState.events)).toBe(true);
    expect(Array.isArray(loaded!.worldState.keyFacts)).toBe(true);
  });

  it('does not crash when loading a legacy session with no scenario', async () => {
    const session = makeStorySession({});
    // Simulate a corrupted/legacy session stored without a scenario field
    (session as unknown as Record<string, unknown>)['scenario'] = undefined;
    const { service } = setup(session);

    const loaded = await service.loadSession(session.id);

    expect(loaded).not.toBeNull();
    // worldState is returned as-is (no normalization without scenario) — must not throw
  });

  it('updates scenario and resets messages when requested', async () => {
    const session = makeStorySession({
      messages: [makeUserMessage('Open the gate', 'action')],
    });
    const { service } = setup(session);

    const updated = await service.updateSessionScenario(session.id, {
      ...session.scenario,
      title: 'Updated',
      setting: 'Updated',
      tone: 'Updated',
      character_name: 'Updated',
      character_description: 'Updated',
    }, true);

    expect(updated.title).toBe('Updated');
    expect(updated.messages).toHaveLength(0);
  });

  it('addQuestToSession adds a quest entry to worldState.questLog', async () => {
    const session = makeStorySession();
    const { service, repository } = setup(session);
    await service.loadSession(session.id);

    await service.addQuestToSession({ id: 'q-1', title: 'Hunt the Wyvern' });

    const saved = (repository.saveSession as jest.Mock).mock.calls.at(-1)?.[0] as typeof session;
    expect(saved.worldState.questLog).toContainEqual({ id: 'q-1', title: 'Hunt the Wyvern', status: 'active' });
  });

  it('addQuestToSession deduplicates by id', async () => {
    const session = makeStorySession({
      worldState: {
        ...makeStorySession().worldState,
        questLog: [{ id: 'q-1', title: 'Old Title', status: 'active' }],
      },
    });
    const { service, repository } = setup(session);
    await service.loadSession(session.id);

    await service.addQuestToSession({ id: 'q-1', title: 'New Title' });

    const saved = (repository.saveSession as jest.Mock).mock.calls.at(-1)?.[0] as typeof session;
    const log = saved.worldState.questLog ?? [];
    expect(log.filter((q) => q.id === 'q-1')).toHaveLength(1);
    expect(log.find((q) => q.id === 'q-1')?.title).toBe('New Title');
  });

  it('addNpcToSession adds an npc entry to worldState.npcStates', async () => {
    const session = makeStorySession();
    const { service, repository } = setup(session);
    await service.loadSession(session.id);

    await service.addNpcToSession({ npcId: 'mira', name: 'Mira' });

    const saved = (repository.saveSession as jest.Mock).mock.calls.at(-1)?.[0] as typeof session;
    expect(saved.worldState.npcStates).toContainEqual({
      npcId: 'mira',
      name: 'Mira',
      status: 'alive',
      disposition: 0,
    });
  });

  it('addNpcToSession deduplicates by npcId', async () => {
    const session = makeStorySession({
      worldState: {
        ...makeStorySession().worldState,
        npcStates: [{ npcId: 'mira', name: 'Mira Old', status: 'alive', disposition: 0 }],
      },
    });
    const { service, repository } = setup(session);
    await service.loadSession(session.id);

    await service.addNpcToSession({ npcId: 'mira', name: 'Mira New' });

    const saved = (repository.saveSession as jest.Mock).mock.calls.at(-1)?.[0] as typeof session;
    const states = saved.worldState.npcStates ?? [];
    expect(states.filter((n) => n.npcId === 'mira')).toHaveLength(1);
    expect(states.find((n) => n.npcId === 'mira')?.name).toBe('Mira New');
  });
});
