import { describe, expect, it, jest } from '@jest/globals';

import { buildApp } from './app';
import { createBackendStore } from './services/backend-store';
import type { LlmClient } from './services/llm-client';

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

describe('llama-proxy-ts app', () => {
  it('exposes provider health and lets the active backend be switched', async () => {
    const app = buildApp({
      backendStore: createBackendStore([
        {
          id: 'local-a',
          name: 'Local A',
          url: 'http://localhost:8080',
          model: 'local-model',
          temperature: 0.8,
          top_p: 0.95,
          top_k: 50,
          repeat_penalty: 1,
          context_window: 8192,
        },
        {
          id: 'local-b',
          name: 'Local B',
          url: 'http://localhost:8081',
          model: 'local-model',
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1,
          context_window: 4096,
        },
      ], 'local-a'),
    });

    const configBefore = await app.inject({ method: 'GET', url: '/config/backends' });
    expect(configBefore.statusCode).toBe(200);
    expect(configBefore.json().active_id).toBe('local-a');

    const patch = await app.inject({
      method: 'PATCH',
      url: '/config/backend',
      payload: { id: 'local-b' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toEqual({ active_id: 'local-b' });

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.json()).toEqual({ status: 'ok', active_backend: 'local-b' });

    await app.close();
  });

  it('validates chat requests and proxies non-streaming local LLM calls', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue('The door opens.');
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/chat',
      payload: {
        messages: [{ role: 'user', content: 'Open the door.', input_type: 'action' }],
        scenario: {
          title: 'Ash Gate',
          setting: 'A burned city gate under black rain.',
          tone: 'tense',
          character_name: 'Mira',
          character_description: 'A watch captain with a broken oath.',
        },
        stream: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reply: 'The door opens.' });
    expect(complete).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: '[Action]: Open the door.' }),
      ]),
      expect.objectContaining({ timeoutMs: 120_000 }),
    );

    await app.close();
  });

  it('streams OpenAI-compatible SSE chunks for local chat', async () => {
    const app = buildApp({
      llmClient: {
        complete: jest.fn<LlmClient['complete']>(),
        stream: async function* () {
          yield 'The ';
          yield 'door opens.';
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/chat',
      payload: {
        messages: [{ role: 'user', content: 'Open the door.', input_type: 'action' }],
        stream: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('data: {"choices":[{"delta":{"content":"The "}}]}');
    expect(response.body).toContain('data: [DONE]');

    await app.close();
  });

  it('normalizes unsupported NPC modes in generated scenarios', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(JSON.stringify({
      ...validScenario,
      npcs: [{ name: 'Sable', description: 'A wary smuggler.', mode: 'complex' }],
    }));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-scenario',
      payload: { description: 'surprise me', scenario_type: 'adventure' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().npcs[0].mode).toBe('detailed');
    expect(complete).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('generates only adventure scenario prompts', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(JSON.stringify(validScenario));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-scenario',
      payload: { description: 'ruined fortress', scenario_type: 'adventure' },
    });

    expect(response.statusCode).toBe(200);
    const prompt = complete.mock.calls[0][0][0].content;
    expect(prompt).toContain('"scenario_type": "adventure"');
    expect(prompt.toLowerCase()).not.toContain('interpersonal');
    expect(prompt).not.toContain('partner_name');

    await app.close();
  });

  it('rejects interpersonal scenario generation requests from the new proxy route', async () => {
    const app = buildApp({
      llmClient: {
        complete: jest.fn<LlmClient['complete']>(),
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-scenario',
      payload: { description: 'relationship drama', scenario_type: 'interpersonal' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('defaults scenario_type to adventure when omitted', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(JSON.stringify(validScenario));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-scenario',
      payload: { description: 'ruined fortress' },
    });

    expect(response.statusCode).toBe(200);
    expect(complete.mock.calls[0][0][0].content).toContain('"scenario_type": "adventure"');
    await app.close();
  });

  it('does not include partner prompt branches in /chat system prompts', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue('The city gate shakes.');
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/chat',
      payload: {
        messages: [{ role: 'user', content: 'Knock on the gate.', input_type: 'action' }],
        scenario: {
          scenario_type: 'adventure',
          title: 'Ash Gate',
          setting: 'A burned city gate under black rain.',
          tone: 'tense',
          character_name: 'Mira',
          character_description: 'A watch captain with a broken oath.',
          partner_name: 'Lena',
          partner_personality: 'steady',
          partner_relationship: 'ally',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const systemPrompt = complete.mock.calls[0][0][0].content;
    expect(systemPrompt).not.toContain('Partner:');
    expect(systemPrompt).not.toContain('Relationship:');

    await app.close();
  });

  it('retries generated scenarios once with a schema repair prompt', async () => {
    const complete = jest.fn<LlmClient['complete']>()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify(validScenario));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-scenario',
      payload: { description: 'surprise me', scenario_type: 'adventure' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Ash Gate');
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1][0][0].content).toContain('reconstruct it as one valid scenario JSON object');

    await app.close();
  });

  it('supports npc, location, and quest oracle generation', async () => {
    const complete = jest.fn<LlmClient['complete']>()
      .mockResolvedValueOnce(JSON.stringify({ oracle_type: 'npc_name', result: 'Mara', detail: 'A scarred scout.' }))
      .mockResolvedValueOnce(JSON.stringify({ oracle_type: 'location_name', result: 'Ashfall Gate', detail: 'Collapsed ramparts.' }))
      .mockResolvedValueOnce(JSON.stringify({ oracle_type: 'quest_hook', result: 'The Missing Ledger', detail: 'Recover records before dawn.' }));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const npc = await app.inject({
      method: 'POST',
      url: '/generate-oracle',
      payload: { oracle_type: 'npc_name' },
    });
    const location = await app.inject({
      method: 'POST',
      url: '/generate-oracle',
      payload: { oracle_type: 'location_name' },
    });
    const quest = await app.inject({
      method: 'POST',
      url: '/generate-oracle',
      payload: { oracle_type: 'quest_hook' },
    });

    expect(npc.statusCode).toBe(200);
    expect(location.statusCode).toBe(200);
    expect(quest.statusCode).toBe(200);
    expect(npc.json().oracle_type).toBe('npc_name');
    expect(location.json().oracle_type).toBe('location_name');
    expect(quest.json().oracle_type).toBe('quest_hook');

    await app.close();
  });

  it('returns generated npc objects with optional stats preserved', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(JSON.stringify({
      name: 'Sable',
      description: 'A wary smuggler.',
      stats: { str: 12, dex: 16 },
    }));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-npc',
      payload: {
        npc_name: 'Sable',
        npc_description: 'Smuggler',
        setting: 'Ash Gate',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().stats).toEqual({ str: 12, dex: 16 });
    await app.close();
  });

  it('includes known ids in world-state update prompt and falls back to empty delta on invalid JSON', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue('not json');
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/world-state/update',
      payload: {
        scenario: {
          ...validScenario,
          npcs: [{ name: 'Sable Scout', description: 'Scout', mode: 'simple' }],
        },
        world_state: { id: 'world-1', scenario_title: 'Ash Gate', factions: [{ id: 'guild' }] },
        last_exchanges: [{ role: 'user', content: 'I question Sable.', input_type: 'dialogue' }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ key_facts_append: [] });
    expect(complete.mock.calls[0][0][0].content).toContain('sable-scout');
    expect(complete.mock.calls[0][0][0].content).toContain('guild');
    await app.close();
  });

  it('falls back to empty world tick delta on invalid model output', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue('not json');
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/world-state/tick',
      payload: { scenario: validScenario, world_state: { id: 'world-1' } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ key_facts_append: [] });
    await app.close();
  });

  it('generates a faction set with 3 factions from scenario context', async () => {
    const factions = [
      { id: 'iron-guild', name: 'Iron Guild', description: 'Merchants of war.', standing: 50 },
      { id: 'ash-council', name: 'Ash Council', description: 'Survivors of the fire.', standing: 50 },
      { id: 'silent-watch', name: 'Silent Watch', description: 'Keepers of the gate.', standing: 50 },
    ];
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(
      JSON.stringify({ factions }),
    );
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-faction-set',
      payload: { scenario: validScenario },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().factions).toHaveLength(3);
    expect(response.json().factions[0].id).toBe('iron-guild');
    await app.close();
  });

  it('returns empty factions array when faction-set LLM response is invalid', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue('not json');
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-faction-set',
      payload: { setting: 'A ruined city', tone: 'grim' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ factions: [] });
    await app.close();
  });

  it('generates an opening scene with title description opening_line and tension', async () => {
    const scene = {
      title: 'The Burning Gate',
      description: 'The gate smolders. Rain does nothing.',
      opening_line: 'The gate is on fire and no one has moved.',
      tension: 'high',
    };
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(JSON.stringify(scene));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-opening-scene',
      payload: { scenario: validScenario },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('The Burning Gate');
    expect(response.json().tension).toBe('high');
    await app.close();
  });

  it('returns blank opening scene fallback when LLM response is invalid', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue('not json');
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generate-opening-scene',
      payload: { setting: 'A dark forest', tone: 'tense' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      title: '',
      description: '',
      opening_line: '',
      tension: 'medium',
    });
    await app.close();
  });

  it('resolves a combat turn and returns narrative hp_changes and round_end', async () => {
    const resolution = {
      narrative: 'Mira strikes the guard across the jaw.',
      hp_changes: { 'guard-1': -8 },
      status_changes: {},
      round_end: false,
    };
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue(JSON.stringify(resolution));
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/combat/resolve-turn',
      payload: {
        action: 'Strike the guard with my shield.',
        combatants: [
          { id: 'mira', name: 'Mira', hp: 30 },
          { id: 'guard-1', name: 'Gate Guard', hp: 15 },
        ],
        round: 1,
        scenario: validScenario,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().narrative).toContain('Mira');
    expect(response.json().hp_changes).toEqual({ 'guard-1': -8 });
    expect(response.json().round_end).toBe(false);
    await app.close();
  });

  it('returns combat turn fallback when LLM response is invalid', async () => {
    const complete = jest.fn<LlmClient['complete']>().mockResolvedValue('not json');
    const app = buildApp({
      llmClient: {
        complete,
        stream: jest.fn<LlmClient['stream']>(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/combat/resolve-turn',
      payload: {
        action: 'Attack.',
        combatants: [{ id: 'hero', name: 'Hero', hp: 20 }],
        round: 2,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      narrative: 'The turn passes.',
      hp_changes: {},
      status_changes: {},
      round_end: false,
    });
    await app.close();
  });
});
