import { TestBed } from '@angular/core/testing';
import { WorldStateService } from './world-state.service';
import { StorageService } from '../shared/storage.service';
import { Scenario } from '../scenario/scenario.model';
import { WorldState, WorldStateDelta } from './world-state.model';

const storageServiceMock: Partial<StorageService> = {
  save: jest.fn().mockResolvedValue(undefined),
  load: jest.fn().mockResolvedValue(null),
  listByPrefix: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue(undefined),
};

const minimalScenario: Scenario = {
  scenarioType: 'adventure',
  title: 'Test World',
  setting: 'Forest',
  tone: 'grim',
  characterName: 'Hero',
  characterDescription: 'Brave',
  npcs: [
    {
      name: 'Aldric',
      description: 'A merchant',
      mode: 'simple',
      personality: 'friendly',
      foes: [],
      friends: [],
      plotTwists: [],
    },
  ],
  rules: [],
};

function emptyDelta(): WorldStateDelta {
  return {
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
}

describe('WorldStateService', () => {
  let service: WorldStateService;

  beforeEach(() => {
    // Reset mock call history
    (storageServiceMock.save as jest.Mock).mockClear();
    (storageServiceMock.load as jest.Mock).mockResolvedValue(null);
    (storageServiceMock.listByPrefix as jest.Mock).mockResolvedValue([]);
    (storageServiceMock.delete as jest.Mock).mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        WorldStateService,
        { provide: StorageService, useValue: storageServiceMock },
      ],
    });

    service = TestBed.inject(WorldStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise state as null', () => {
    expect(service.state()).toBeNull();
  });

  describe('initForScenario', () => {
    it('should set a non-null state after init', () => {
      service.initForScenario(minimalScenario);
      expect(service.state()).not.toBeNull();
    });

    it('should set scenarioTitle from scenario', () => {
      service.initForScenario(minimalScenario);
      expect(service.state()?.scenarioTitle).toBe('Test World');
    });

    it('should create NPC states for each NPC in scenario', () => {
      service.initForScenario(minimalScenario);
      const npcStates = service.state()?.npcStates ?? [];
      expect(npcStates).toHaveLength(1);
      expect(npcStates[0].name).toBe('Aldric');
      expect(npcStates[0].npcId).toBe('Aldric');
    });

    it('should initialise turnCount to 0', () => {
      service.initForScenario(minimalScenario);
      expect(service.state()?.turnCount).toBe(0);
    });

    it('should set bondState to null for adventure scenario', () => {
      service.initForScenario(minimalScenario);
      expect(service.state()?.bondState).toBeNull();
    });

    it('should create bondState for interpersonal scenario', () => {
      const interpersonal: Scenario = { ...minimalScenario, scenarioType: 'interpersonal' };
      service.initForScenario(interpersonal);
      expect(service.state()?.bondState).not.toBeNull();
      expect(service.state()?.bondState?.tier).toBe(0);
    });

    it('should initialise worldClock to day 1 morning spring', () => {
      service.initForScenario(minimalScenario);
      const clock = service.state()?.worldClock;
      expect(clock?.dayNumber).toBe(1);
      expect(clock?.timeOfDay).toBe('morning');
      expect(clock?.season).toBe('spring');
    });
  });

  describe('applyDelta', () => {
    beforeEach(() => {
      service.initForScenario(minimalScenario);
    });

    it('should append keyFacts', () => {
      const delta = emptyDelta();
      delta.keyFactsAppend = ['Aldric is a spy'];

      service.applyDelta(delta);

      expect(service.state()?.keyFacts).toContain('Aldric is a spy');
    });

    it('should append new events and increment turnCount', () => {
      const delta = emptyDelta();
      delta.newEvents = [
        {
          title: 'Ambush!',
          description: 'Goblins attack',
          type: 'combat',
          certainty: 'witnessed',
          involvedNpcIds: [],
          involvedFactionIds: [],
        },
      ];

      service.applyDelta(delta);

      expect(service.state()?.storyEvents).toHaveLength(1);
      expect(service.state()?.storyEvents[0].title).toBe('Ambush!');
    });

    it('should advance clock by given number of turns', () => {
      const delta = emptyDelta();
      delta.clockAdvance = { turns: 1 };

      service.applyDelta(delta);

      // morning + 1 = afternoon
      expect(service.state()?.worldClock.timeOfDay).toBe('afternoon');
    });

    it('should advance day number when clock wraps past night', () => {
      const delta = emptyDelta();
      delta.clockAdvance = { turns: 5 }; // morning(0)+5 wraps past night(4) once → day 2

      service.applyDelta(delta);

      expect(service.state()?.worldClock.dayNumber).toBe(2);
    });

    it('should apply NPC disposition delta (valid NPC)', () => {
      const delta = emptyDelta();
      delta.npcChanges = [
        {
          npcId: 'Aldric',
          newStatus: null,
          dispositionDelta: 10,
          newKnownFacts: [],
          notesAppend: '',
        },
      ];

      service.applyDelta(delta);

      const aldric = service.state()?.npcStates.find(n => n.npcId === 'Aldric');
      expect(aldric?.disposition).toBe(10);
    });

    it('should discard NPC changes for unknown npcId', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const delta = emptyDelta();
      delta.npcChanges = [
        {
          npcId: 'nonexistent',
          newStatus: null,
          dispositionDelta: 99,
          newKnownFacts: [],
          notesAppend: '',
        },
      ];

      service.applyDelta(delta);

      // The original NPC should be unchanged
      const aldric = service.state()?.npcStates.find(n => n.npcId === 'Aldric');
      expect(aldric?.disposition).toBe(0);
      consoleSpy.mockRestore();
    });

    it('should clamp NPC disposition delta to ±25', () => {
      const delta = emptyDelta();
      delta.npcChanges = [
        {
          npcId: 'Aldric',
          newStatus: null,
          dispositionDelta: 100,
          newKnownFacts: [],
          notesAppend: '',
        },
      ];

      service.applyDelta(delta);

      const aldric = service.state()?.npcStates.find(n => n.npcId === 'Aldric');
      expect(aldric?.disposition).toBe(25); // clamped from 100
    });

    it('should inject ambient event into queue', () => {
      const delta = emptyDelta();
      delta.ambientInject = 'Thunder rumbles in the distance';

      service.applyDelta(delta);

      expect(service.state()?.ambientQueue).toHaveLength(1);
      expect(service.state()?.ambientQueue[0].text).toBe('Thunder rumbles in the distance');
    });

    it('should not mutate state when called with no-op delta', () => {
      const before = service.state()?.turnCount ?? 0;
      service.applyDelta(emptyDelta());
      // turnCount only advances by number of newEvents mapped
      expect(service.state()?.turnCount).toBe(before);
    });
  });

  describe('consumeAmbient', () => {
    it('should return null when ambient queue is empty', () => {
      service.initForScenario(minimalScenario);
      expect(service.consumeAmbient()).toBeNull();
    });

    it('should return and remove the first ambient event', () => {
      service.initForScenario(minimalScenario);
      const delta = emptyDelta();
      delta.ambientInject = 'Wolves howl';
      service.applyDelta(delta);

      const event = service.consumeAmbient();

      expect(event?.text).toBe('Wolves howl');
      expect(service.state()?.ambientQueue).toHaveLength(0);
    });
  });

  describe('clearState', () => {
    it('should set state to null', () => {
      service.initForScenario(minimalScenario);
      service.clearState();
      expect(service.state()).toBeNull();
    });
  });

  describe('addEvent', () => {
    it('should append an event to storyEvents', () => {
      service.initForScenario(minimalScenario);
      service.addEvent({
        title: 'Discovery',
        description: 'Found a hidden chest',
        type: 'discovery',
        certainty: 'witnessed',
        involvedNpcIds: [],
        involvedFactionIds: [],
      });

      expect(service.state()?.storyEvents).toHaveLength(1);
      expect(service.state()?.storyEvents[0].title).toBe('Discovery');
    });

    it('should increment turnCount', () => {
      service.initForScenario(minimalScenario);
      const before = service.state()!.turnCount;
      service.addEvent({
        title: 'x',
        description: 'y',
        type: 'world',
        certainty: 'witnessed',
        involvedNpcIds: [],
        involvedFactionIds: [],
      });
      expect(service.state()!.turnCount).toBe(before + 1);
    });
  });

  describe('toCompactPrompt', () => {
    it('should return empty string when no state', () => {
      expect(service.toCompactPrompt()).toBe('');
    });

    it('should return a non-empty string when state is initialised', () => {
      service.initForScenario(minimalScenario);
      // Add a current scene to get time info rendered
      service.updateScene({ tension: 'calm', sceneNote: 'Dawn breaks', presentNpcIds: [] });
      const prompt = service.toCompactPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('detectContradictions', () => {
    it('should return empty array when no state', () => {
      expect(service.detectContradictions('text')).toEqual([]);
    });

    it('should flag a dead NPC appearing in narrative', () => {
      service.initForScenario(minimalScenario);
      // Kill Aldric
      const delta = emptyDelta();
      delta.npcChanges = [
        {
          npcId: 'Aldric',
          newStatus: 'dead',
          dispositionDelta: 0,
          newKnownFacts: [],
          notesAppend: '',
        },
      ];
      service.applyDelta(delta);

      const issues = service.detectContradictions('Aldric greets you warmly');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('Aldric');
    });

    it('should return empty array when dead NPC is not mentioned', () => {
      service.initForScenario(minimalScenario);
      const delta = emptyDelta();
      delta.npcChanges = [
        { npcId: 'Aldric', newStatus: 'dead', dispositionDelta: 0, newKnownFacts: [], notesAppend: '' },
      ];
      service.applyDelta(delta);

      const issues = service.detectContradictions('The road is quiet today');
      expect(issues).toHaveLength(0);
    });
  });
});
