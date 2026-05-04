import cors from '@fastify/cors';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { z, ZodError, type ZodType } from 'zod';
import {
  assistRequestSchema,
  backendPatchRequestSchema,
  chatRequestSchema,
  combatResolveTurnRequestSchema,
  combatResolveTurnResponseSchema,
  generateFactionSetRequestSchema,
  generateFactionSetResponseSchema,
  generateNpcRequestSchema,
  generateOpeningSceneRequestSchema,
  generateOpeningSceneResponseSchema,
  generateOracleResponseSchema,
  generateOracleRequestSchema,
  generateQuestRequestSchema,
  generateScenarioRequestSchema,
  npcSchema,
  scenarioSchema,
  worldStateDeltaSchema,
  worldStateUpdateRequestSchema,
} from '@nx-monorepo-experiment/shared-api-contracts';

import { buildChatMessages } from './prompts/story-prompts';
import { createBackendStore, type BackendStore } from './services/backend-store';
import { createLlmClient, type ApiMessage, type LlmClient, type LlmClientHooks } from './services/llm-client';
import { parseJsonObject } from './utils/json';

export interface AppDeps {
  backendStore?: BackendStore;
  llmClient?: LlmClient;
  loggerInstance?: FastifyBaseLogger;
}

export function buildApp(deps: AppDeps = {}): FastifyInstance {
  const backendStore = deps.backendStore ?? createBackendStore();
  const debugLoggingEnabled = process.env['PROXY_TS_DEBUG_LOGGING'] === '1';
  const app = deps.loggerInstance
    ? Fastify({ loggerInstance: deps.loggerInstance })
    : Fastify({ logger: true });
  const llmClient = deps.llmClient ?? createLlmClient(
    () => backendStore.active(),
    createLlmLoggerHooks(app.log, debugLoggingEnabled),
  );
  const adventureScenarioRequestSchema = generateScenarioRequestSchema.extend({
    scenario_type: z.literal('adventure').default('adventure'),
  });

  void app.register(cors, {
    origin: ['http://localhost:4200'],
    methods: ['GET', 'POST', 'PATCH'],
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn({
        route: request.url,
        statusCode: 400,
        issueCount: error.issues.length,
        issues: error.issues,
      }, 'proxy request validation failed');
      reply.status(400).send({
        error_type: 'validation_error',
        message: 'Request body failed validation.',
        detail: error.issues,
      });
      return;
    }
    request.log.error({
      route: request.url,
      statusCode: 500,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 'proxy request failed');
    reply.status(500).send({
      error_type: 'internal_error',
      message: 'Internal server error',
      detail: error instanceof Error ? error.message : String(error),
    });
  });

  app.get('/health', async (request) => {
    request.log.info({
      route: '/health',
      activeBackendId: backendStore.active().id,
    }, 'proxy health requested');
    return {
      status: 'ok',
      active_backend: backendStore.active().id,
    };
  });

  app.get('/config/backends', async (request) => {
    request.log.info({
      route: '/config/backends',
      activeBackendId: backendStore.active().id,
      backendCount: backendStore.list().length,
    }, 'proxy backend config requested');
    return {
      backends: backendStore.list(),
      active_id: backendStore.active().id,
    };
  });

  app.patch('/config/backend', async (request, reply) => {
    const body = parseBody(backendPatchRequestSchema, request.body);
    const previousBackendId = backendStore.active().id;
    const active = backendStore.setActive(body.id);
    if (!active) {
      request.log.warn({
        route: '/config/backend',
        previousBackendId,
        requestedBackendId: body.id,
      }, 'proxy backend switch failed');
      reply.status(404);
      return { detail: `Backend '${body.id}' not found` };
    }
    request.log.info({
      route: '/config/backend',
      previousBackendId,
      requestedBackendId: body.id,
      nextBackendId: active.id,
    }, 'proxy backend switched');
    return { active_id: active.id };
  });

  app.post('/chat', async (request, reply) => {
    const body = parseBody(chatRequestSchema, request.body);
    const messages = buildChatMessages(body);
    const startedAt = Date.now();
    request.log.info({
      route: '/chat',
      backendId: backendStore.active().id,
      stream: body.stream,
      messageCount: messages.length,
      scenarioType: body.scenario?.scenario_type ?? 'none',
      hasWorldState: Boolean(body.world_state),
      enableThinking: body.enable_thinking,
    }, 'proxy chat request started');
    if (debugLoggingEnabled) {
      request.log.debug({
        route: '/chat',
        messages,
      }, 'proxy request content');
    }

    if (body.stream) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      });

      try {
        let chunkCount = 0;
        let totalChars = 0;
        for await (const token of llmClient.stream(messages, {
          timeoutMs: 120_000,
          enableThinking: body.enable_thinking,
        })) {
          chunkCount += 1;
          totalChars += token.length;
          reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
        }
        request.log.info({
          route: '/chat',
          backendId: backendStore.active().id,
          stream: true,
          durationMs: Date.now() - startedAt,
          chunkCount,
          totalChars,
        }, 'proxy chat request completed');
        reply.raw.end('data: [DONE]\n\n');
      } catch (error) {
        request.log.error({
          route: '/chat',
          backendId: backendStore.active().id,
          stream: true,
          durationMs: Date.now() - startedAt,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }, 'proxy chat stream failed');
        reply.raw.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`);
        reply.raw.end();
      }
      return;
    }

    const replyText = await llmClient.complete(messages, {
      timeoutMs: 120_000,
      enableThinking: body.enable_thinking,
    });
    request.log.info({
      route: '/chat',
      backendId: backendStore.active().id,
      stream: false,
      durationMs: Date.now() - startedAt,
      messageCount: messages.length,
      replyLength: replyText.length,
    }, 'proxy chat request completed');
    return { reply: replyText };
  });

  app.post('/assist', async (request) => {
    const body = parseBody(assistRequestSchema, request.body);
    const startedAt = Date.now();
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
    request.log.info({
      route: '/assist',
      backendId: backendStore.active().id,
      mode: body.mode,
      inputType: body.input_type,
      messageCount: messages.length,
      scenarioType: body.scenario?.scenario_type ?? 'none',
    }, 'proxy assist request started');
    if (debugLoggingEnabled) {
      request.log.debug({
        route: '/assist',
        messages,
      }, 'proxy request content');
    }
    const text = await llmClient.complete(messages, { timeoutMs: 30_000 });
    request.log.info({
      route: '/assist',
      backendId: backendStore.active().id,
      mode: body.mode,
      durationMs: Date.now() - startedAt,
      responseLength: text.length,
    }, 'proxy assist request completed');
    return { text: text.trim().replace(/^["']|["']$/g, '') };
  });

  app.post('/generate-scenario', async (request) => {
    const body = parseBody(adventureScenarioRequestSchema, request.body);
    const startedAt = Date.now();
    const messages: ApiMessage[] = [
      { role: 'system', content: buildScenarioGenerationPrompt() },
      { role: 'user', content: body.description },
    ];
    request.log.info({
      route: '/generate-scenario',
      backendId: backendStore.active().id,
      descriptionLength: body.description.length,
      scenarioType: body.scenario_type,
    }, 'proxy scenario generation started');
    if (debugLoggingEnabled) {
      request.log.debug({
        route: '/generate-scenario',
        messages,
      }, 'proxy request content');
    }
    const raw = await llmClient.complete(messages, { timeoutMs: 60_000, jsonMode: true });
    if (debugLoggingEnabled) {
      request.log.debug({
        route: '/generate-scenario',
        rawOutput: raw,
      }, 'proxy model output');
    }
    const firstAttempt = parseScenarioResponse(raw);
    if (firstAttempt.success) {
      request.log.info({
        route: '/generate-scenario',
        backendId: backendStore.active().id,
        durationMs: Date.now() - startedAt,
        repaired: false,
      }, 'proxy scenario generation completed');
      return firstAttempt.scenario;
    }

    request.log.warn({
      route: '/generate-scenario',
      attempt: 'repair',
      errorMessage: summarizeError('error' in firstAttempt ? firstAttempt.error : 'unknown'),
    }, 'proxy scenario generation required repair');
    const repairMessages: ApiMessage[] = [
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
    ];
    if (debugLoggingEnabled) {
      request.log.debug({
        route: '/generate-scenario',
        messages: repairMessages,
      }, 'proxy request content');
    }
    const repaired = await llmClient.complete(repairMessages, { timeoutMs: 45_000, jsonMode: true });
    if (debugLoggingEnabled) {
      request.log.debug({
        route: '/generate-scenario',
        rawOutput: repaired,
      }, 'proxy model output');
    }
    const secondAttempt = parseScenarioResponse(repaired);
    if (secondAttempt.success) {
      request.log.info({
        route: '/generate-scenario',
        backendId: backendStore.active().id,
        durationMs: Date.now() - startedAt,
        repaired: true,
      }, 'proxy scenario generation completed');
      return secondAttempt.scenario;
    }

    const error = new Error('The LLM did not return valid scenario JSON after one repair attempt.');
    (error as Error & { cause?: unknown }).cause = 'error' in secondAttempt ? secondAttempt.error : undefined;
    throw error;
  });

  app.post('/generate-npc', async (request) => {
    const body = parseBody(generateNpcRequestSchema, request.body);
    request.log.info({
      route: '/generate-npc',
      backendId: backendStore.active().id,
      npcName: body.npc_name ?? '',
    }, 'proxy npc generation started');
    const raw = await llmClient.complete([
      { role: 'system', content: 'Generate a detailed D&D 2024 NPC profile. Output only valid JSON.' },
      { role: 'user', content: JSON.stringify(body) },
    ], { timeoutMs: 120_000, jsonMode: true });
    try {
      return npcSchema.parse(parseJsonObject(raw));
    } catch {
      request.log.warn({
        route: '/generate-npc',
        fallback: 'default_npc',
      }, 'proxy npc generation returned invalid JSON');
      return { name: body.npc_name ?? 'Unknown', description: body.npc_description ?? '', stats: {}, abilities: [], equipment: [], personality: '', motivation: '', secret: '' };
    }
  });

  app.post('/generate-quest', async (request) => {
    const body = parseBody(generateQuestRequestSchema, request.body);
    const raw = await llmClient.complete([
      { role: 'system', content: 'Generate a detailed D&D 2024 quest. Output only valid JSON.' },
      { role: 'user', content: JSON.stringify(body) },
    ], { timeoutMs: 180_000, jsonMode: true });
    return parseJsonObject(raw);
  });

  app.post('/generate-oracle', async (request) => {
    const body = parseBody(generateOracleRequestSchema, request.body);
    request.log.info({
      route: '/generate-oracle',
      backendId: backendStore.active().id,
      oracleType: body.oracle_type,
    }, 'proxy oracle generation started');
    const raw = await llmClient.complete([
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
      request.log.warn({
        route: '/generate-oracle',
        fallback: 'default_oracle',
        oracleType: body.oracle_type,
      }, 'proxy oracle generation returned invalid JSON');
      return { oracle_type: 'quest_hook' as const, result: 'The oracle is silent.', detail: '' };
    }
  });

  app.post('/world-state/update', async (request) => {
    const body = parseBody(worldStateUpdateRequestSchema, request.body);
    const knownNpcIds = body.scenario.npcs.map((npc) => npc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const knownFactionIds = Array.isArray((body.world_state as Record<string, unknown>)['factions'])
      ? ((body.world_state as Record<string, unknown>)['factions'] as Array<{ id?: string }>)
        .map((faction) => faction.id)
        .filter((id): id is string => Boolean(id))
      : [];
    const raw = await llmClient.complete([
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
      request.log.warn({
        route: '/world-state/update',
        fallback: 'empty_delta',
      }, 'proxy world-state update returned invalid JSON');
      return worldStateDeltaSchema.parse({});
    }
  });

  app.post('/world-state/summary', async (request) => {
    const body = request.body as { last_messages?: Array<{ role: string; content: string }> };
    const raw = await llmClient.complete([
      { role: 'system', content: 'Summarize this RPG session in 3-5 sentences. Return JSON: {"summary":"","keyFacts":[]}' },
      { role: 'user', content: JSON.stringify(body.last_messages ?? []) },
    ], { timeoutMs: 30_000, jsonMode: true, temperature: 0.15 });
    return parseJsonObject(raw);
  });

  app.post('/generate-faction-set', async (request) => {
    const body = parseBody(generateFactionSetRequestSchema, request.body);
    const setting = body.scenario?.setting ?? body.setting;
    const tone = body.scenario?.tone ?? body.tone;
    const title = body.scenario?.title ?? '';
    const raw = await llmClient.complete([
      {
        role: 'system',
        content: [
          'You are a world-building expert for interactive RPG stories.',
          title ? `Scenario: ${title}` : '',
          setting ? `Setting: ${setting}` : '',
          tone ? `Tone: ${tone}` : '',
          '',
          'Generate exactly 3 factions with conflicting goals that fit the scenario.',
          'Each faction must have a distinct ideological motivation.',
          'Output only valid JSON with this exact shape:',
          '{"factions": [{"id": "slug", "name": "...", "description": "...", "standing": 50}, ...]}',
          'The "id" field must be a lowercase hyphenated slug. standing defaults to 50.',
          'Include exactly 3 factions in the array.',
        ].filter(Boolean).join('\n'),
      },
      { role: 'user', content: 'Generate the 3 factions.' },
    ], { timeoutMs: 45_000, jsonMode: true });
    try {
      return generateFactionSetResponseSchema.parse(parseJsonObject(raw));
    } catch {
      request.log.warn({
        route: '/generate-faction-set',
        fallback: 'empty_factions',
      }, 'proxy faction generation returned invalid JSON');
      return { factions: [] };
    }
  });

  app.post('/generate-opening-scene', async (request) => {
    const body = parseBody(generateOpeningSceneRequestSchema, request.body);
    const setting = body.scenario?.setting ?? body.setting;
    const tone = body.scenario?.tone ?? body.tone;
    const title = body.scenario?.title ?? '';
    const characterName = body.scenario?.character_name ?? '';
    const characterDesc = body.scenario?.character_description ?? '';
    const raw = await llmClient.complete([
      {
        role: 'system',
        content: [
          'You are a master storyteller crafting the opening of an interactive RPG session.',
          title ? `Scenario: ${title}` : '',
          setting ? `Setting: ${setting}` : '',
          tone ? `Tone: ${tone}` : '',
          characterName ? `Player character: ${characterName}${characterDesc ? ` — ${characterDesc}` : ''}` : '',
          '',
          'Generate an opening scene. Output only valid JSON with this exact shape:',
          '{"title": "...", "description": "...", "opening_line": "...", "tension": "low|medium|high|extreme"}',
          'tension must be exactly one of: low, medium, high, extreme.',
          'ALL fields must be filled.',
        ].filter(Boolean).join('\n'),
      },
      { role: 'user', content: 'Generate the opening scene.' },
    ], { timeoutMs: 45_000, jsonMode: true });
    try {
      return generateOpeningSceneResponseSchema.parse(parseJsonObject(raw));
    } catch {
      request.log.warn({
        route: '/generate-opening-scene',
        fallback: 'blank_scene',
      }, 'proxy opening scene returned invalid JSON');
      return { title: '', description: '', opening_line: '', tension: 'medium' as const };
    }
  });

  app.post('/combat/resolve-turn', async (request) => {
    const body = parseBody(combatResolveTurnRequestSchema, request.body);
    const combatantLines = body.combatants
      .map((c) => `  ${c.name} (id: ${c.id}) — HP ${c.hp}`)
      .join('\n');
    const raw = await llmClient.complete([
      {
        role: 'system',
        content: [
          'You are a combat resolver for an interactive RPG.',
          'Resolve one combat turn and return a JSON object.',
          '',
          body.scenario ? `Scenario: ${body.scenario.title} | Tone: ${body.scenario.tone}` : '',
          `Round: ${body.round}`,
          `Combatants:\n${combatantLines || '  (none)'}`,
          `Action: ${body.action}`,
          '',
          'Output only valid JSON with this exact shape:',
          '{"narrative": "...", "hp_changes": {"entityId": -5}, "status_changes": {"entityId": "dead"}, "round_end": false}',
          'hp_changes: map of entity id to hp delta (negative = damage, positive = healing). Omit entries with no change.',
          'status_changes: map of entity id to new status. Only include when clearly warranted (e.g. "dead").',
          'round_end: true when all combatants have taken a turn this round.',
        ].filter(Boolean).join('\n'),
      },
      { role: 'user', content: 'Resolve this combat turn.' },
    ], { timeoutMs: 30_000, jsonMode: true, temperature: 0.1 });
    try {
      return combatResolveTurnResponseSchema.parse(parseJsonObject(raw));
    } catch {
      request.log.warn({
        route: '/combat/resolve-turn',
        fallback: 'default_turn',
      }, 'proxy combat resolution returned invalid JSON');
      return { narrative: 'The turn passes.', hp_changes: {}, status_changes: {}, round_end: false };
    }
  });

  app.post('/world-state/tick', async (request) => {
    const body = request.body as { world_state?: unknown; scenario?: unknown };
    const raw = await llmClient.complete([
      {
        role: 'system',
        content: [
          'Generate a subtle living-world tick as WorldStateDelta JSON.',
          'Allowed fields: ambient_inject, npc_rumors, faction_drift.',
          'Return empty delta when no meaningful drift exists.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify(body ?? {}),
      },
    ], { timeoutMs: 25_000, jsonMode: true, temperature: 0.2 });
    try {
      return worldStateDeltaSchema.parse(parseJsonObject(raw));
    } catch {
      request.log.warn({
        route: '/world-state/tick',
        fallback: 'empty_delta',
      }, 'proxy world tick returned invalid JSON');
      return worldStateDeltaSchema.parse({});
    }
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
    '  "rules": ["string"],',
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

function createLlmLoggerHooks(logger: FastifyBaseLogger, debugLoggingEnabled: boolean): LlmClientHooks {
  return {
    onRequestStart(event) {
      logger.info({
        backendId: event.backendId,
        backendUrl: event.backendUrl,
        model: event.model,
        stream: event.stream,
        jsonMode: event.jsonMode,
        enableThinking: event.enableThinking,
        timeoutMs: event.timeoutMs,
        messageCount: event.messageCount,
      }, 'proxy llm request started');
      if (debugLoggingEnabled) {
        logger.debug({
          backendId: event.backendId,
          model: event.model,
          messages: event.messages,
        }, 'proxy llm request content');
      }
    },
    onRequestSuccess(event) {
      logger.info({
        backendId: event.backendId,
        model: event.model,
        stream: event.stream,
        durationMs: event.durationMs,
        responseLength: event.responseLength,
        chunkCount: event.chunkCount,
        totalChars: event.totalChars,
      }, 'proxy llm request completed');
    },
    onRequestError(event) {
      logger.error({
        backendId: event.backendId,
        model: event.model,
        stream: event.stream,
        durationMs: event.durationMs,
        statusCode: event.statusCode,
        errorMessage: event.errorMessage,
      }, 'proxy llm request failed');
    },
  };
}
