import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AiAssistService } from './ai-assist.service';
import { ScenarioService } from '../scenario/scenario.service';
import { Scenario } from '../scenario/scenario.model';
import { ChatMessage } from '../chat/chat.service';

const sampleScenario: Scenario = {
  scenarioType: 'adventure',
  title: 'Dragon Hunt',
  setting: 'Mountains',
  tone: 'epic',
  characterName: 'Kira',
  characterDescription: 'A ranger',
  npcs: [
    {
      name: 'Elder Mage',
      description: 'Wise wizard',
      mode: 'simple',
      personality: 'calm',
      foes: [],
      friends: [],
      plotTwists: [],
    },
  ],
  rules: ['no mercy'],
};

const sampleMessages: ChatMessage[] = [
  { role: 'user', content: 'I attack the goblin', inputType: 'action' },
  { role: 'assistant', content: 'The goblin dodges' },
];

describe('AiAssistService', () => {
  let service: AiAssistService;
  let fetchMock: jest.Mock;
  let activeScenarioSignal: ReturnType<typeof signal<Scenario | null>>;

  beforeEach(() => {
    activeScenarioSignal = signal<Scenario | null>(null);
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    TestBed.configureTestingModule({
      providers: [
        AiAssistService,
        {
          provide: ScenarioService,
          useValue: { activeScenario: activeScenarioSignal },
        },
      ],
    });

    service = TestBed.inject(AiAssistService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('suggestInput — /assist payload', () => {
    it('should POST to /assist with mode=suggest', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'How about you flee?' }),
      });

      await service.suggestInput(sampleMessages, 'dialogue');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/assist');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body as string);
      expect(body.mode).toBe('suggest');
    });

    it('should include input_type in the payload', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ text: '' }) });

      await service.suggestInput(sampleMessages, 'action');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.input_type).toBe('action');
    });

    it('should map messages with input_type defaulting to dialogue', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ text: '' }) });

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }, // no inputType
        { role: 'assistant', content: 'Hi' },
      ];
      await service.suggestInput(messages, 'dialogue');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages[0].input_type).toBe('dialogue');
    });

    it('should set scenario to null when no active scenario', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ text: '' }) });

      await service.suggestInput([], 'dialogue');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.scenario).toBeNull();
    });

    it('should include serialised scenario when one is active', async () => {
      activeScenarioSignal.set(sampleScenario);
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ text: '' }) });

      await service.suggestInput([], 'dialogue');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.scenario).not.toBeNull();
      expect(body.scenario.title).toBe('Dragon Hunt');
      expect(body.scenario.scenario_type).toBe('adventure');
      expect(body.scenario.character_name).toBe('Kira');
    });

    it('should map NPC fields with snake_case keys', async () => {
      activeScenarioSignal.set(sampleScenario);
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ text: '' }) });

      await service.suggestInput([], 'dialogue');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const npc = body.scenario.npcs[0];
      expect(npc.name).toBe('Elder Mage');
      expect(npc.plot_twists).toEqual([]);
    });

    it('should return the text field from the response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'Attack the left flank!' }) });

      const result = await service.suggestInput([], 'dialogue');

      expect(result).toBe('Attack the left flank!');
    });

    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(service.suggestInput([], 'dialogue')).rejects.toThrow('HTTP 500');
    });
  });

  describe('rewriteInput — /assist payload', () => {
    it('should POST to /assist with mode=rewrite and the provided text', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'Rewritten text' }) });

      await service.rewriteInput('I hit him', sampleMessages, 'action');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.mode).toBe('rewrite');
      expect(body.current_text).toBe('I hit him');
    });
  });

  describe('generateScenario', () => {
    it('should POST to /generate-scenario and map the response', async () => {
      const raw = {
        scenario_type: 'adventure',
        title: 'New Adventure',
        setting: 'Forest',
        tone: 'dark',
        character_name: 'Rex',
        character_description: 'Soldier',
        npcs: [],
        rules: ['pvp on'],
        partner_name: '',
        partner_gender: '',
        partner_personality: '',
        partner_body_description: '',
        partner_appearance: '',
        partner_relationship: '',
        partner_likes: '',
        partner_dislikes: '',
        partner_turn_ons: '',
      };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => raw });

      const result = await service.generateScenario('A forest adventure', 'adventure');

      expect(result.title).toBe('New Adventure');
      expect(result.characterName).toBe('Rex');
      expect(result.scenarioType).toBe('adventure');
    });

    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(service.generateScenario('test', 'adventure')).rejects.toThrow('HTTP 503');
    });
  });

  describe('generateNpc', () => {
    it('should POST to /generate-npc with correct snake_case body fields', async () => {
      const raw = { name: 'Goblin', stats: {} };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => raw });

      await service.generateNpc('Goblin', 'small creature', 'cave', 'dark', 'Cave Raid');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.npc_name).toBe('Goblin');
      expect(body.npc_description).toBe('small creature');
      expect(body.setting).toBe('cave');
      expect(body.tone).toBe('dark');
      expect(body.title).toBe('Cave Raid');
    });

    it('should return the raw response JSON', async () => {
      const raw = { name: 'Troll', stats: { str: 18 } };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => raw });

      const result = await service.generateNpc('Troll', 'big', 'bridge', 'grim', 'Bridge of Doom');

      expect(result).toEqual(raw);
    });

    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

      await expect(service.generateNpc('x', 'x', 'x', 'x', 'x')).rejects.toThrow('HTTP 400');
    });
  });

  describe('generateQuest', () => {
    const rawQuest = {
      title: 'Slay the Dragon',
      description: 'Kill it',
      objectives: ['Find the dragon', 'Kill it'],
      rewards: { gold: 100, silver: 50, items: ['Sword'] },
      encounters: [
        { description: 'Fight!', monsters: [{ name: 'Dragon', cr: '20' }] },
      ],
      difficulty: 'Hard',
      setting: 'Mountains',
      estimated_duration: '3h',
      party_level: 10,
      xp_budget: 5000,
    };

    it('should POST to /generate-quest with correct body', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => rawQuest });

      await service.generateQuest('slay a dragon', 'Mountains', 'epic', 10);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.prompt).toBe('slay a dragon');
      expect(body.setting).toBe('Mountains');
      expect(body.tone).toBe('epic');
      expect(body.party_level).toBe(10);
    });

    it('should map response into Quest object with camelCase fields', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => rawQuest });

      const quest = await service.generateQuest('test');

      expect(quest.title).toBe('Slay the Dragon');
      expect(quest.estimatedDuration).toBe('3h');
      expect(quest.partyLevel).toBe(10);
      expect(quest.xpBudget).toBe(5000);
      expect(quest.encounters[0].monsters[0].name).toBe('Dragon');
    });

    it('should default missing quest fields to safe values', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const quest = await service.generateQuest('minimal');

      expect(quest.title).toBe('');
      expect(quest.objectives).toEqual([]);
      expect(quest.rewards.gold).toBe(0);
      expect(quest.encounters).toEqual([]);
    });

    it('should use null for party_level when not provided', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await service.generateQuest('test');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.party_level).toBeNull();
    });
  });
});
