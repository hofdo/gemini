import { OpenRouterStoryProvider, OPENROUTER_DEFAULT_MODEL } from './openrouter-story.provider';

describe('OpenRouterStoryProvider', () => {
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

  it('requests scenario generation through the cloud proxy and advertises the configured OpenRouter model', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        scenario_type: 'adventure',
        title: 'Ash Gate',
        setting: 'A burned city gate under black rain.',
        tone: 'tense',
        character_name: 'Mira',
        character_description: 'A watch captain with a broken oath.',
        npcs: [],
        rules: [],
      }),
    } as Response);
    const provider = new OpenRouterStoryProvider();

    const scenario = await provider.generateScenario({
      prompt: 'A burned city gate',
      scenarioType: 'adventure',
    });

    expect(scenario.title).toBe('Ash Gate');
    expect(fetch).toHaveBeenCalledWith('/cloud/generate-scenario', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-OpenRouter-Model': OPENROUTER_DEFAULT_MODEL,
      }),
    }));
  });
});
