import { describe, expect, it, jest } from '@jest/globals';
import type { FastifyBaseLogger } from 'fastify';

import { buildApp } from './app';
import type { OpenRouterClient } from './services/openrouter-client';

const validScenario = {
  scenario_type: 'adventure',
  title: 'Ash Gate',
  setting: 'A burned city gate under black rain.',
  tone: 'tense',
  character_name: 'Mira',
  character_description: 'A watch captain with a broken oath.',
  npcs: [],
  rules: [],
};

function createMockLogger() {
  const logger = {
    level: 'info',
    silent: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger as unknown as FastifyBaseLogger & typeof logger;
}

describe('openrouter-proxy-ts app', () => {
  it('reports health for the configured OpenRouter model', async () => {
    const app = buildApp({
      config: {
        apiKey: 'test-key',
        model: 'openai/gpt-5-mini',
        appTitle: 'Story Companion',
        httpReferer: 'http://localhost:4300',
        temperature: 0.8,
        topP: 0.95,
      },
    });

    const response = await app.inject({ method: 'GET', url: '/cloud/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', active_backend: 'openai/gpt-5-mini' });

    await app.close();
  });

  it('streams OpenAI-compatible SSE chunks for cloud chat', async () => {
    const app = buildApp({
      client: {
        complete: jest.fn<OpenRouterClient['complete']>(),
        stream: async function* () {
          yield 'The ';
          yield 'storm breaks.';
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/cloud/chat',
      payload: {
        messages: [{ role: 'user', content: 'Describe the gate.', input_type: 'dialogue' }],
        stream: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('data: {"choices":[{"delta":{"content":"The "}}]}');
    expect(response.body).toContain('data: [DONE]');

    await app.close();
  });

  it('generates only adventure scenarios through the cloud route', async () => {
    const logger = createMockLogger();
    const complete = jest
      .fn<OpenRouterClient['complete']>()
      .mockResolvedValueOnce(JSON.stringify(validScenario));
    const app = buildApp({
      loggerInstance: logger,
      client: {
        complete,
        stream: jest.fn<OpenRouterClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/cloud/generate-scenario',
      payload: { description: 'ruined fortress', scenario_type: 'adventure' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().scenario_type).toBe('adventure');
    const prompt = complete.mock.calls[0][0][0].content;
    expect(prompt).toContain('"scenario_type": "adventure"');
    expect(prompt.toLowerCase()).not.toContain('interpersonal');

    await app.close();
  });
});
