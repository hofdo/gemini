import { TestBed } from '@angular/core/testing';
import { WorldSyncService } from './world-sync.service';
import { WorldState } from '../world-state/world-state.model';

function minimalWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    _schemaVersion: 3,
    id: 'ws-1',
    scenarioTitle: 'Test',
    currentScene: null,
    worldClock: { dayNumber: 1, timeOfDay: 'morning', season: 'spring', turnsPerDay: 8 },
    factions: [],
    locations: [],
    npcStates: [
      {
        npcId: 'Aldric',
        name: 'Aldric',
        status: 'alive',
        disposition: 0,
        relationships: [],
        knownFacts: [],
        notes: '',
      },
    ],
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
    bondState: null,
    combatState: null,
    ...overrides,
  };
}

describe('WorldSyncService', () => {
  let service: WorldSyncService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    TestBed.configureTestingModule({ providers: [WorldSyncService] });
    service = TestBed.inject(WorldSyncService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('shouldTriggerUpdate', () => {
    it('should return true when last message mentions a known NPC name', () => {
      const ws = minimalWorldState();
      expect(service.shouldTriggerUpdate('Aldric walks away', ws)).toBe(true);
    });

    it('should return false when last message mentions no known entities', () => {
      const ws = minimalWorldState();
      expect(service.shouldTriggerUpdate('The weather is fine', ws)).toBe(false);
    });

    it('should return true when message mentions a faction name', () => {
      const ws = minimalWorldState({
        factions: [
          {
            id: 'f1',
            name: 'Iron Guild',
            description: '',
            archetypes: [],
            standing: 0,
            territories: [],
            allies: [],
            enemies: [],
            notes: '',
          },
        ],
      });
      expect(service.shouldTriggerUpdate('The Iron Guild attacked', ws)).toBe(true);
    });

    it('should return true when message mentions a location name', () => {
      const ws = minimalWorldState({
        locations: [
          {
            id: 'l1',
            name: 'Shadowkeep',
            description: '',
            currentEvents: [],
            visitCount: 0,
          },
        ],
      });
      expect(service.shouldTriggerUpdate('We arrived at Shadowkeep', ws)).toBe(true);
    });

    it('should return false when world state has no known entities', () => {
      const ws = minimalWorldState({ npcStates: [] });
      expect(service.shouldTriggerUpdate('Hello world', ws)).toBe(false);
    });
  });

  describe('updateWorldState', () => {
    it('should POST to /world-state/update', async () => {
      const delta = {
        factionChanges: [],
        npcChanges: [],
        newEvents: [],
        sceneUpdate: null,
        clockAdvance: null,
        keyFactsAppend: [],
        questUpdates: [],
        playerUpdate: null,
        storyBeatUpdate: null,
        ambientInject: null,
        npcRumors: [],
        factionDrift: [],
        bondUpdate: null,
        combatDelta: null,
      };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => delta });

      const ws = minimalWorldState();
      const result = await service.updateWorldState({
        scenario: { title: 'Test' },
        world_state: ws,
        last_exchanges: [{ role: 'user', content: 'Hello', input_type: 'dialogue' }],
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/world-state/update');
      expect(init.method).toBe('POST');
      expect(result).toEqual(delta);
    });

    it('should throw when response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        service.updateWorldState({ scenario: {}, world_state: minimalWorldState(), last_exchanges: [] })
      ).rejects.toThrow('500');
    });
  });

  describe('worldTick', () => {
    it('should POST to /world-state/tick', async () => {
      const delta = { factionChanges: [], npcChanges: [], newEvents: [], sceneUpdate: null, clockAdvance: null, keyFactsAppend: [], questUpdates: [], playerUpdate: null, storyBeatUpdate: null, ambientInject: null, npcRumors: [], factionDrift: [], bondUpdate: null, combatDelta: null };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => delta });

      await service.worldTick(minimalWorldState(), { title: 'Test' });

      expect(fetchMock.mock.calls[0][0]).toBe('/world-state/tick');
    });

    it('should throw when response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(service.worldTick(minimalWorldState(), {})).rejects.toThrow('503');
    });
  });

  describe('generateSummary', () => {
    it('should POST to /world-state/summary and return result', async () => {
      const summary = { summary: 'Battle won', keyFacts: ['Dragon defeated'] };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => summary });

      const result = await service.generateSummary(
        minimalWorldState(),
        { title: 'Test' },
        [{ role: 'user', content: 'We won!', inputType: 'action' }]
      );

      expect(fetchMock.mock.calls[0][0]).toBe('/world-state/summary');
      expect(result).toEqual(summary);
    });

    it('should return null when response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await service.generateSummary(minimalWorldState(), {}, []);

      expect(result).toBeNull();
    });

    it('should map messages using input_type with fallback to dialogue', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ summary: '', keyFacts: [] }) });

      await service.generateSummary(
        minimalWorldState(),
        {},
        [{ role: 'user', content: 'hi' }] // no inputType
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.last_messages[0].input_type).toBe('dialogue');
    });
  });
});
