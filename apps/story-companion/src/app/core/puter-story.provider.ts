import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  generateOracleResponseSchema,
  scenarioSchema,
  type ChatMessageDto,
  type ScenarioDto,
  type WorldStateDeltaDto,
  worldStateDeltaSchema,
} from '@nx-monorepo-experiment/shared-api-contracts';
import type { ScenarioGenerationRequest, StoryChatRequest, StoryProvider } from './story-types';

export const PUTER_GROK_MODEL = 'x-ai/grok-4.3';

export interface PuterLike {
  ai: {
    chat: (messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => Promise<unknown>;
  };
}

declare global {
  interface Window {
    puter?: PuterLike;
  }
}

export const PUTER_INSTANCE = new InjectionToken<PuterLike>('PUTER_INSTANCE');

@Injectable({ providedIn: 'root' })
export class PuterStoryProvider implements StoryProvider {
  public puter: PuterLike | null = inject(PUTER_INSTANCE, { optional: true });
  private cancellationRequested = false;

  async generateScenario(request: ScenarioGenerationRequest): Promise<ScenarioDto> {
    const response = await this.chat([
      {
        role: 'system',
        content: [
          'Generate one adventure RPG scenario only.',
          'Return only valid JSON with snake_case keys matching the scenario schema.',
          'Set "scenario_type" to "adventure".',
          'Do not include partner-focused framing.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Prompt: ${request.prompt}`,
      },
    ]);
    return scenarioSchema.parse(parseJsonFromPuterResponse(response));
  }

  async *streamChat(request: StoryChatRequest): AsyncIterable<string> {
    this.cancellationRequested = false;
    const puter = await this.getPuter();
    const response = await puter.ai.chat([
      {
        role: 'system',
        content: `You are the narrator for "${request.session.scenario.title}". Setting: ${request.session.scenario.setting}`,
      },
      ...request.messages.map(toPuterMessage),
    ], {
      model: PUTER_GROK_MODEL,
      stream: true,
    });

    for await (const chunk of response as AsyncIterable<{ text?: string }>) {
      if (this.cancellationRequested) break;
      if (chunk.text) yield chunk.text;
    }
  }

  async extractWorldDelta(request: StoryChatRequest): Promise<WorldStateDeltaDto> {
    const response = await this.chat([
      {
        role: 'system',
        content: 'Extract concrete world-state changes from these story messages. Return only JSON WorldStateDelta with snake_case keys.',
      },
      ...request.messages.slice(-6).map(toPuterMessage),
    ]);
    try {
      return worldStateDeltaSchema.parse(parseJsonFromPuterResponse(response));
    } catch {
      return worldStateDeltaSchema.parse({});
    }
  }

  async summarizeSession(request: StoryChatRequest): Promise<{ summary: string; keyFacts: string[] }> {
    const response = await this.chat([
      {
        role: 'system',
        content: 'Summarize this RPG session in 3-5 sentences and return JSON: {"summary":"","keyFacts":[]}.',
      },
      ...request.messages.slice(-20).map(toPuterMessage),
    ]);
    try {
      const parsed = parseJsonFromPuterResponse(response) as { summary?: string; keyFacts?: string[] };
      return {
        summary: parsed.summary ?? '',
        keyFacts: parsed.keyFacts ?? [],
      };
    } catch {
      return { summary: '', keyFacts: [] };
    }
  }

  async generateOracle(request: {
    oracleType: 'npc_name' | 'location_name' | 'quest_hook';
    worldStateSummary?: string;
    scenarioTitle?: string;
    setting?: string;
  }) {
    const response = await this.chat([
      {
        role: 'system',
        content: [
          'Generate one adventure oracle response as JSON.',
          'Return only JSON with keys: oracle_type, result, detail.',
          'oracle_type must be one of npc_name, location_name, quest_hook.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          oracle_type: request.oracleType,
          world_state_summary: request.worldStateSummary ?? '',
          scenario_title: request.scenarioTitle ?? '',
          setting: request.setting ?? '',
        }),
      },
    ]);
    return generateOracleResponseSchema.parse(parseJsonFromPuterResponse(response));
  }

  cancelGeneration(): void {
    this.cancellationRequested = true;
  }

  private async chat(messages: Array<{ role: string; content: string }>): Promise<unknown> {
    const puter = await this.getPuter();
    return puter.ai.chat(messages, {
      model: PUTER_GROK_MODEL,
    });
  }

  private async getPuter(): Promise<PuterLike> {
    if (this.puter) return this.puter;
    if (!window.puter) {
      await loadPuterScript();
    }
    if (!window.puter) {
      throw new Error('Puter.js did not load.');
    }
    this.puter = window.puter;
    return this.puter;
  }
}

function loadPuterScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-puter-js]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Puter.js.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    script.dataset['puterJs'] = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Puter.js.'));
    document.head.appendChild(script);
  });
}

function toPuterMessage(message: ChatMessageDto): { role: string; content: string } {
  return {
    role: message.role,
    content: message.content,
  };
}

function parseJsonFromPuterResponse(response: unknown): unknown {
  const content = extractContent(response);
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('Puter response did not include JSON.');
  return JSON.parse(content.slice(first, last + 1));
}

function extractContent(response: unknown): string {
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object') {
    const message = (response as { message?: { content?: unknown } }).message;
    if (typeof message?.content === 'string') return message.content;
  }
  return String(response);
}
