import { describe, expect, it, jest } from '@jest/globals';

import { createLlmClient, type ApiMessage } from './llm-client';

const backend = {
  id: 'local-a',
  name: 'Local A',
  url: 'http://localhost:8080',
  model: 'local-model',
  temperature: 0.8,
  top_p: 0.95,
  top_k: 50,
  repeat_penalty: 1,
  context_window: 8192,
};

describe('createLlmClient logging hooks', () => {
  it('emits request start and success hook events for complete calls', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'The door opens.' } }],
      }),
    } as Response);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    const hooks = {
      onRequestStart: jest.fn(),
      onRequestSuccess: jest.fn(),
      onRequestError: jest.fn(),
    };
    const client = createLlmClient(() => backend, hooks);
    const messages: ApiMessage[] = [{ role: 'user', content: 'Open the door.' }];

    const result = await client.complete(messages, { timeoutMs: 12_000, jsonMode: true });

    expect(result).toBe('The door opens.');
    expect(hooks.onRequestStart).toHaveBeenCalledWith(expect.objectContaining({
      backendId: 'local-a',
      messageCount: 1,
      stream: false,
      jsonMode: true,
    }));
    expect(hooks.onRequestSuccess).toHaveBeenCalledWith(expect.objectContaining({
      backendId: 'local-a',
      stream: false,
      responseLength: 'The door opens.'.length,
    }));
    expect(hooks.onRequestError).not.toHaveBeenCalled();
  });

  it('emits request error hook events for failed complete calls', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'backend unavailable',
    } as Response);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    const hooks = {
      onRequestStart: jest.fn(),
      onRequestSuccess: jest.fn(),
      onRequestError: jest.fn(),
    };
    const client = createLlmClient(() => backend, hooks);

    await expect(client.complete([{ role: 'user', content: 'Open the door.' }], { timeoutMs: 12_000 }))
      .rejects
      .toThrow('LLM HTTP 503: backend unavailable');

    expect(hooks.onRequestError).toHaveBeenCalledWith(expect.objectContaining({
      backendId: 'local-a',
      statusCode: 503,
      stream: false,
    }));
    expect(hooks.onRequestSuccess).not.toHaveBeenCalled();
  });
});
