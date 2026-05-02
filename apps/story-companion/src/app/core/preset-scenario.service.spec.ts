import { PresetScenarioService } from './preset-scenario.service';

describe('PresetScenarioService', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads preset index and scenarios', async () => {
    const service = new PresetScenarioService();
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'grim-frontier', label: 'Grim Frontier', path: 'scenarios/adventure/grim-frontier.json' }],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenario_type: 'adventure',
          title: 'The Last Stockade',
          setting: 'Dustwall',
          tone: 'grimdark',
          character_name: 'Mira',
          character_description: 'Veteran scout',
          npcs: [],
          rules: [],
        }),
      } as Response);

    const index = await service.loadIndex();
    const scenario = await service.loadScenario({ path: index[0].path });

    expect(index).toHaveLength(1);
    expect(scenario.scenario_type).toBe('adventure');
  });
});
