import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CombatService } from './combat.service';
import { StorySessionService } from './story-session.service';
import type { StorySession } from './story-types';

function makeSession(overrides: Partial<StorySession> = {}): StorySession {
  return {
    id: 'session-1',
    title: 'Test',
    providerMode: 'local',
    scenario: {
      scenario_type: 'adventure',
      title: 'Test',
      setting: 'Forest',
      tone: 'gritty',
      character_name: 'Hero',
      character_description: 'A brave hero',
      npcs: [],
      rules: [],
      partner_name: '',
      partner_gender: '',
      partner_personality: '',
      partner_body_description: '',
      partner_appearance: '',
      partner_relationship: '',
      partner_likes: '',
      partner_dislikes: '',
      partner_turn_ons: '',
    },
    messages: [],
    worldState: {
      id: 'world-1',
      scenario_title: 'Test',
      npcStates: [
        { npcId: 'goblin-1', name: 'Goblin', status: 'alive', disposition: -50 },
        { npcId: 'orc-1', name: 'Orc', status: 'alive', disposition: -75 },
      ],
      events: [],
      questLog: [],
      combat: null,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CombatService', () => {
  let service: CombatService;
  let mockStory: {
    activeSession: ReturnType<typeof signal<StorySession | null>>;
    setCombatState: jest.Mock;
    appendWorldEvent: jest.Mock;
    addNpcToSession: jest.Mock;
  };

  beforeEach(() => {
    const sessionSignal = signal<StorySession | null>(makeSession());

    mockStory = {
      activeSession: sessionSignal,
      setCombatState: jest.fn().mockImplementation(async (combat) => {
        const current = sessionSignal();
        if (current) {
          sessionSignal.set({ ...current, worldState: { ...current.worldState, combat } });
        }
      }),
      appendWorldEvent: jest.fn().mockResolvedValue(undefined),
      addNpcToSession: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        CombatService,
        { provide: StorySessionService, useValue: mockStory },
      ],
    });

    service = TestBed.inject(CombatService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('startCombat', () => {
    it('sets combat active with given npc ids', async () => {
      await service.startCombat(['goblin-1', 'orc-1']);

      expect(mockStory.setCombatState).toHaveBeenCalledWith({
        active: true,
        round: 1,
        initiativeOrder: ['goblin-1', 'orc-1'],
        activeEntityIndex: 0,
        log: [],
      });
    });

    it('does nothing when there is no active session', async () => {
      mockStory.activeSession.set(null);

      await service.startCombat(['goblin-1']);

      expect(mockStory.setCombatState).not.toHaveBeenCalled();
    });

    it('starts combat with a single npc', async () => {
      await service.startCombat(['goblin-1']);

      const call = mockStory.setCombatState.mock.calls[0][0];
      expect(call.initiativeOrder).toEqual(['goblin-1']);
      expect(call.active).toBe(true);
    });
  });

  describe('endCombat', () => {
    beforeEach(() => {
      const sessionWithCombat = makeSession({
        messages: [
          { id: 'm1', role: 'user', content: 'attack', input_type: 'action', createdAt: '' },
          { id: 'm2', role: 'assistant', content: 'you swing', input_type: 'dialogue', createdAt: '' },
          { id: 'm3', role: 'user', content: 'dodge', input_type: 'action', createdAt: '' },
        ],
        worldState: {
          id: 'world-1',
          scenario_title: 'Test',
          npcStates: [],
          events: [{ id: 'evt-0', title: 'Existing', description: 'prior', type: 'world', turn: 1 }],
          questLog: [],
          combat: {
            active: true,
            round: 2,
            initiativeOrder: ['goblin-1'],
            activeEntityIndex: 0,
            log: [{ round: 1, actor: 'goblin-1', narrative: 'Goblin attacks!' }],
          },
        },
      });
      mockStory.activeSession.set(sessionWithCombat);
    });

    it('sets combat inactive and appends world event for victory', async () => {
      await service.endCombat('victory');

      expect(mockStory.setCombatState).toHaveBeenCalledWith(
        expect.objectContaining({ active: false }),
      );

      expect(mockStory.appendWorldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Combat Ended',
          description: 'The party emerged victorious from combat.',
          type: 'combat',
          turn: 2, // 2 user messages
        }),
      );
    });

    it('sets combat inactive and appends world event for flee', async () => {
      await service.endCombat('flee');

      expect(mockStory.setCombatState).toHaveBeenCalledWith(
        expect.objectContaining({ active: false }),
      );
      expect(mockStory.appendWorldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'The party fled from combat.',
          type: 'combat',
        }),
      );
    });

    it('sets combat inactive and appends world event for tpk', async () => {
      await service.endCombat('tpk');

      expect(mockStory.appendWorldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'The party was defeated in combat.',
        }),
      );
    });

    it('appended event has a unique id', async () => {
      await service.endCombat('victory');

      const call = mockStory.appendWorldEvent.mock.calls[0][0];
      expect(call.id).toBeTruthy();
      expect(call.id).toMatch(/^event-/);
    });

    it('does nothing when no active session', async () => {
      mockStory.activeSession.set(null);

      await service.endCombat('victory');

      expect(mockStory.setCombatState).not.toHaveBeenCalled();
      expect(mockStory.appendWorldEvent).not.toHaveBeenCalled();
    });

    it('does nothing when combat is null', async () => {
      const sessionNoCombat = makeSession();
      mockStory.activeSession.set(sessionNoCombat);

      await service.endCombat('victory');

      expect(mockStory.setCombatState).not.toHaveBeenCalled();
    });
  });
});
