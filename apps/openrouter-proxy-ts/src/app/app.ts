import cors from '@fastify/cors';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { z, ZodError, type ZodType } from 'zod';
import {
  assistRequestSchema,
  chatRequestSchema,
  generateOracleResponseSchema,
  generateOracleRequestSchema,
  generateScenarioRequestSchema,
  scenarioSchema,
  worldStateDeltaSchema,
  worldStateUpdateRequestSchema,
} from '@nx-monorepo-experiment/shared-api-contracts';

import { buildChatMessages } from './prompts/story-prompts';
import { parseJsonObject } from './utils/json';
import {
  createOpenRouterClient,
  loadOpenRouterConfigFromEnv,
  type ApiMessage,
  type OpenRouterClient,
  type OpenRouterConfig,
} from './services/openrouter-client';

export interface AppDeps {
  client?: OpenRouterClient;
  config?: OpenRouterConfig;
  loggerInstance?: FastifyBaseLogger;
}

export function buildApp(deps: AppDeps = {}): FastifyInstance {
  const config = deps.config ?? loadOpenRouterConfigFromEnv();
  const client = deps.client ?? createOpenRouterClient(() => config);
  const app = deps.loggerInstance
    ? Fastify({ loggerInstance: deps.loggerInstance })
    : Fastify({ logger: true });
  const adventureScenarioRequestSchema = generateScenarioRequestSchema.extend({
    scenario_type: z.literal('adventure').default('adventure'),
  });

  void app.register(cors, {
    origin: ['http://localhost:4300'],
    methods: ['GET', 'POST'],
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error_type: 'validation_error',
        message: 'Request body failed validation.',
        detail: error.issues,
      });
      return;
    }

    request.log.error({
      route: request.url,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 'openrouter proxy request failed');
    reply.status(500).send({
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  });

  app.get('/cloud/health', async () => ({
    status: config.apiKey ? 'ok' : 'misconfigured',
    active_backend: config.model,
  }));

  app.post('/cloud/chat', async (request, reply) => {
    const body = parseBody(chatRequestSchema, request.body);
    const messages = buildChatMessages(body);

    if (body.stream) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      });

      try {
        for await (const token of client.stream(messages, {
          timeoutMs: 120_000,
          enableThinking: body.enable_thinking,
        })) {
          reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
        }
        reply.raw.end('data: [DONE]\n\n');
      } catch (error) {
        reply.raw.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`);
        reply.raw.end();
      }
      return;
    }

    const text = await client.complete(messages, {
      timeoutMs: 120_000,
      enableThinking: body.enable_thinking,
    });
    return { reply: text };
  });

  app.post('/cloud/assist', async (request) => {
    const body = parseBody(assistRequestSchema, request.body);
    const context = body.scenario
      ? `Scenario: ${body.scenario.title}\nSetting: ${body.scenario.setting}\nTone: ${body.scenario.tone}`
      : '';
    const mode = body.mode === 'rewrite'
      ? `Rewrite this player input and output only the rewritten text: ${body.current_text}`
      : 'Suggest what the player character might say or do next. Output only the suggestion.';
    const messages = [
      { role: 'system', content: `You are a creative writing assistant.\n${context}` },
      ...body.messages.slice(-10).map((message) => ({ role: message.role, content: message.content })),
      { role: 'user', content: mode },
    ] as ApiMessage[];
    const text = await client.complete(messages, { timeoutMs: 30_000 });
    return { text: text.trim().replace(/^["']|["']$/g, '') };
  });

  app.post('/cloud/generate-scenario', async (request) => {
    const body = parseBody(adventureScenarioRequestSchema, request.body);
    const raw = await client.complete([
      { role: 'system', content: buildScenarioGenerationPrompt() },
      { role: 'user', content: body.description },
    ], { timeoutMs: 60_000, jsonMode: true });

    const firstAttempt = parseScenarioResponse(raw);
    if (firstAttempt.success) return firstAttempt.scenario;

    request.log.warn({
      route: '/cloud/generate-scenario',
      attempt: 'repair',
      errorMessage: summarizeError('error' in firstAttempt ? firstAttempt.error : 'unknown'),
    }, 'openrouter scenario generation required repair');

    const repaired = await client.complete([
      {
        role: 'system',
        content: [
          'The following text is not valid for the scenario schema.',
          'Extract or reconstruct it as one valid scenario JSON object.',
          'Output only the corrected JSON object, with no markdown or explanation.',
          '',
          buildScenarioGenerationPrompt(),
        ].join('\n'),
      },
      { role: 'user', content: raw },
    ], { timeoutMs: 45_000, jsonMode: true });
    const secondAttempt = parseScenarioResponse(repaired);
    if (secondAttempt.success) return secondAttempt.scenario;

    throw new Error('The OpenRouter model did not return valid scenario JSON after one repair attempt.');
  });

  app.post('/cloud/generate-oracle', async (request) => {
    const body = parseBody(generateOracleRequestSchema, request.body);
    const raw = await client.complete([
      {
        role: 'system',
        content: [
          'Generate one adventure oracle result.',
          'Return only JSON with keys oracle_type, result, detail.',
          'oracle_type must be npc_name, location_name, or quest_hook.',
        ].join(' '),
      },
      { role: 'user', content: JSON.stringify(body) },
    ], { timeoutMs: 45_000, jsonMode: true });
    try {
      return generateOracleResponseSchema.parse(parseJsonObject(raw));
    } catch {
      return { oracle_type: 'quest_hook' as const, result: 'The oracle is silent.', detail: '' };
    }
  });

  app.post('/cloud/world-state/update', async (request) => {
    const body = parseBody(worldStateUpdateRequestSchema, request.body);
    const knownNpcIds = body.scenario.npcs.map((npc) => npc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const knownFactionIds = Array.isArray((body.world_state as Record<string, unknown>)['factions'])
      ? ((body.world_state as Record<string, unknown>)['factions'] as Array<{ id?: string }>)
        .map((faction) => faction.id)
        .filter((id): id is string => Boolean(id))
      : [];
    const raw = await client.complete([
      {
        role: 'system',
        content: [
          'Extract only concrete world-state changes from the exchanges.',
          'Output only JSON WorldStateDelta with snake_case keys.',
          'Use known NPC IDs only:',
          knownNpcIds.join(', ') || 'none',
          'Use known faction IDs only:',
          knownFactionIds.join(', ') || 'none',
          'Only mark death when explicit.',
          'Cap disposition changes to small shifts unless clearly drastic.',
          'Return an empty delta if nothing changed.',
        ].join('\n'),
      },
      ...body.last_exchanges.map((message) => ({ role: message.role, content: message.content })),
    ], { timeoutMs: 30_000, jsonMode: true, temperature: 0.15 });
    try {
      return worldStateDeltaSchema.parse(parseJsonObject(raw));
    } catch {
      return worldStateDeltaSchema.parse({});
    }
  });

  app.post('/cloud/world-state/summary', async (request) => {
    const body = request.body as { last_messages?: Array<{ role: string; content: string }> };
    const raw = await client.complete([
      { role: 'system', content: 'Summarize this RPG session in 3-5 sentences. Return JSON: {"summary":"","keyFacts":[]}' },
      { role: 'user', content: JSON.stringify(body.last_messages ?? []) },
    ], { timeoutMs: 30_000, jsonMode: true, temperature: 0.15 });
    return parseJsonObject(raw);
  });

  return app;
}

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

function buildScenarioGenerationPrompt(): string {
  return [
    'Generate one complete adventure RPG scenario.',
    'Output only valid JSON using snake_case keys.',
    'The JSON must match this shape:',
    '{',
    '  "scenario_type": "adventure",',
    '  "title": "string",',
    '  "setting": "string",',
    '  "tone": "string",',
    '  "character_name": "string",',
    '  "character_description": "string",',
    '  "npcs": [{"name": "string", "description": "string", "mode": "simple"}],',
    '  "rules": ["string"]',
    '}',
    'NPC mode must be exactly "simple" or "detailed". Never use "complex", "advanced", or any other value.',
    'Include 2-3 NPCs and 2-4 rules.',
    'Do not output partner-focused content.',
  ].join('\n');
}

function parseScenarioResponse(raw: string):
  | { success: true; scenario: unknown }
  | { success: false; error: unknown } {
  try {
    const parsed = parseJsonObject(raw);
    return { success: true, scenario: scenarioSchema.parse(normalizeScenarioCandidate(parsed)) };
  } catch (error) {
    return { success: false, error };
  }
}

function normalizeScenarioCandidate(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const scenario = { ...(candidate as Record<string, unknown>) };
  if (Array.isArray(scenario['npcs'])) {
    scenario['npcs'] = scenario['npcs'].map((npc) => {
      if (!npc || typeof npc !== 'object') return npc;
      const nextNpc = { ...(npc as Record<string, unknown>) };
      const mode = nextNpc['mode'];
      if (mode !== undefined && mode !== 'simple' && mode !== 'detailed') {
        nextNpc['mode'] = 'detailed';
      }
      return nextNpc;
    });
  }
  return scenario;
}

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
