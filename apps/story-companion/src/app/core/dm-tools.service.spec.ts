import { TestBed } from '@angular/core/testing';
import { DmToolsService } from './dm-tools.service';

function mockFetch(responseBody: unknown, ok = true): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => responseBody,
  } as Response);
}

describe('DmToolsService', () => {
  let service: DmToolsService;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
    TestBed.configureTestingModule({ providers: [DmToolsService] });
    service = TestBed.inject(DmToolsService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('generateQuest', () => {
    it('calls POST /generate-quest with correct body', async () => {
      const fetchSpy = mockFetch({
        title: 'Hunt the Wyvern',
        description: 'A wyvern terrorises the valley.',
        objectives: ['Find the lair', 'Slay the wyvern'],
        reward: '500 gold',
      });

      const quest = await service.generateQuest('Hunt the wyvern', 3, 'mountain valley', 'gritty');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/generate-quest',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Hunt the wyvern',
            party_level: 3,
            setting: 'mountain valley',
            tone: 'gritty',
          }),
        }),
      );
      expect(quest.title).toBe('Hunt the Wyvern');
      expect(quest.objectives).toHaveLength(2);
      expect(quest.partyLevel).toBe(3);
    });

    it('assigns an id to the returned quest', async () => {
      mockFetch({ title: 'Test', description: '', objectives: [], reward: '' });
      const quest = await service.generateQuest('Test', 1);
      expect(quest.id).toBeTruthy();
    });

    it('throws when the proxy returns a non-ok status', async () => {
      mockFetch({}, false);
      await expect(service.generateQuest('test', 1)).rejects.toThrow('HTTP 500');
    });
  });

  describe('generateNpc', () => {
    it('calls POST /generate-npc with correct body', async () => {
      const fetchSpy = mockFetch({
        name: 'Mira',
        description: 'A watch captain.',
        mode: 'simple',
        personality: 'stern',
        foes: [],
        friends: [],
        plot_twists: [],
      });

      const npc = await service.generateNpc('Mira', 'A watch captain.', 'city', 'gritty');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/generate-npc',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            npc_name: 'Mira',
            npc_description: 'A watch captain.',
            setting: 'city',
            tone: 'gritty',
            title: '',
          }),
        }),
      );
      expect(npc.name).toBe('Mira');
    });

    it('throws when the proxy returns a non-ok status', async () => {
      mockFetch({}, false);
      await expect(service.generateNpc('Mira', 'desc')).rejects.toThrow('HTTP 500');
    });
  });
});
