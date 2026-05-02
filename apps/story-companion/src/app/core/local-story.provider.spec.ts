import { ReadableStream } from 'node:stream/web';

import { LocalStoryProvider } from './local-story.provider';
import { makeStorySession } from './story-factories';

describe('LocalStoryProvider', () => {
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

  it('generates a scenario through the TypeScript proxy and validates the response', async () => {
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
    const provider = new LocalStoryProvider();

    const scenario = await provider.generateScenario({
      prompt: 'A burned city gate',
      scenarioType: 'adventure',
    });

    expect(scenario.title).toBe('Ash Gate');
    expect(fetch).toHaveBeenCalledWith('/generate-scenario', expect.objectContaining({
      method: 'POST',
    }));
    const fetchOptions = (fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(fetchOptions.body).toContain('"scenario_type":"adventure"');
  });

  it('streams chat tokens from OpenAI-compatible SSE chunks', async () => {
    const encoder = new TextEncoder();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"The "}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"gate opens."}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      }),
    } as Response);
    const provider = new LocalStoryProvider();

    const tokens = [];
    for await (const token of provider.streamChat({
      session: makeStorySession(),
      messages: [],
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['The ', 'gate opens.']);
  });

  it('sends oracle generation requests to the TS proxy', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        oracle_type: 'npc_name',
        result: 'Mara',
        detail: 'A scarred scout.',
      }),
    } as Response);
    const provider = new LocalStoryProvider();

    const oracle = await provider.generateOracle({
      oracleType: 'npc_name',
      scenarioTitle: 'Ash Gate',
      setting: 'Burned city gate',
      worldStateSummary: 'The gate is barred.',
    });

    expect(oracle.result).toBe('Mara');
    const fetchOptions = (fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(fetchOptions.body).toContain('"oracle_type":"npc_name"');
  });
});
