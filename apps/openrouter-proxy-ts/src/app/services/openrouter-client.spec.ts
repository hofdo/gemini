import { describe, expect, it, jest } from '@jest/globals';

import {
  createOpenRouterClient,
  type OpenRouterConfig,
  type OpenRouterSdkFactory,
} from './openrouter-client';

describe('createOpenRouterClient', () => {
  const config: OpenRouterConfig = {
    apiKey: 'test-key',
    model: 'openai/gpt-5-mini',
    appTitle: 'Story Companion',
    httpReferer: 'http://localhost:4300',
    temperature: 0.8,
    topP: 0.95,
  };

  it('builds one SDK client and sends non-streaming chat with the SDK request shape', async () => {
    const send = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      choices: [{ message: { content: '42' } }],
    });
    const sdkFactory = jest.fn<OpenRouterSdkFactory>().mockResolvedValue({
      chat: { send },
    } as Awaited<ReturnType<OpenRouterSdkFactory>>);
    const client = createOpenRouterClient(() => config, sdkFactory);

    const result = await client.complete(
      [{ role: 'user', content: 'What is the meaning of life?' }],
      {
        timeoutMs: 12_000,
        jsonMode: true,
        enableThinking: true,
        temperature: 0.42,
      },
    );

    expect(result).toBe('42');
    expect(sdkFactory).toHaveBeenCalledTimes(1);
    expect(sdkFactory).toHaveBeenCalledWith(config);
    expect(send).toHaveBeenCalledWith(
      {
        chatRequest: {
          model: 'openai/gpt-5-mini',
          messages: [{ role: 'user', content: 'What is the meaning of life?' }],
          temperature: 0.42,
          topP: 0.95,
          responseFormat: { type: 'json_object' },
          reasoning: { effort: 'medium' },
        },
      },
      { timeoutMs: 12_000 },
    );
  });

  it('reuses the same SDK client and streams token deltas', async () => {
    const send = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'ready' } }],
      })
      .mockResolvedValueOnce(streamChunks());
    const sdkFactory = jest.fn<OpenRouterSdkFactory>().mockResolvedValue({
      chat: { send },
    } as Awaited<ReturnType<OpenRouterSdkFactory>>);
    const client = createOpenRouterClient(() => config, sdkFactory);

    await client.complete([{ role: 'user', content: 'Ping' }]);

    const tokens: string[] = [];
    for await (const token of client.stream(
      [{ role: 'user', content: 'Describe the storm.' }],
      { timeoutMs: 9_000, enableThinking: true },
    )) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['The ', 'storm breaks.']);
    expect(sdkFactory).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith(
      {
        chatRequest: {
          model: 'openai/gpt-5-mini',
          messages: [{ role: 'user', content: 'Describe the storm.' }],
          temperature: 0.8,
          topP: 0.95,
          stream: true,
          reasoning: { effort: 'medium' },
        },
      },
      { timeoutMs: 9_000 },
    );
  });
});

async function* streamChunks() {
  yield { choices: [{ delta: { content: 'The ' } }] };
  yield { choices: [{ delta: { content: 'storm breaks.' } }] };
  yield { choices: [{ delta: {} }] };
}
