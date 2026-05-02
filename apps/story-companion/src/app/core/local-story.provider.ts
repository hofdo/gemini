import { Injectable } from '@angular/core';
import {
  generateOracleResponseSchema,
  scenarioSchema,
  type ChatMessageDto,
  type WorldStateDeltaDto,
  worldStateDeltaSchema,
} from '@nx-monorepo-experiment/shared-api-contracts';
import type { ScenarioGenerationRequest, StoryChatRequest, StoryProvider } from './story-types';

@Injectable({ providedIn: 'root' })
export class LocalStoryProvider implements StoryProvider {
  private activeChatAbortController: AbortController | null = null;

  async generateScenario(request: ScenarioGenerationRequest) {
    const response = await fetch('/generate-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: request.prompt,
        scenario_type: request.scenarioType,
      }),
    });
    if (!response.ok) throw new Error(`Scenario generation failed: HTTP ${response.status}`);
    return scenarioSchema.parse(await response.json());
  }

  async *streamChat(request: StoryChatRequest): AsyncIterable<string> {
    this.activeChatAbortController = new AbortController();
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.activeChatAbortController.signal,
        body: JSON.stringify({
          messages: toDtoMessages(request.messages),
          scenario: request.session.scenario,
          world_state: request.session.worldState,
          stream: true,
          enable_thinking: false,
          tone_settings: {
            pacing: 'deliberate',
            register: 'balanced',
            boundary: 'standard',
          },
        }),
      });
      if (!response.ok) throw new Error(`Chat failed: HTTP ${response.status}`);
      if (!response.body) throw new Error('Chat response has no body.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: [DONE]')) return;
          if (!line.startsWith('data: ')) continue;
          const chunk = JSON.parse(line.slice(6)) as { choices?: Array<{ delta?: { content?: string } }> };
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) yield token;
        }
      }
    } finally {
      this.activeChatAbortController = null;
    }
  }

  async extractWorldDelta(request: StoryChatRequest): Promise<WorldStateDeltaDto> {
    const response = await fetch('/world-state/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: request.session.scenario,
        world_state: request.session.worldState,
        last_exchanges: toDtoMessages(request.messages.slice(-6)),
      }),
    });
    if (!response.ok) return worldStateDeltaSchema.parse({});
    return worldStateDeltaSchema.parse(await response.json());
  }

  async summarizeSession(request: StoryChatRequest): Promise<{ summary: string; keyFacts: string[] }> {
    const response = await fetch('/world-state/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        last_messages: toDtoMessages(request.messages.slice(-20)),
      }),
    });
    if (!response.ok) {
      return { summary: '', keyFacts: [] };
    }
    const payload = (await response.json()) as { summary?: string; keyFacts?: string[] };
    return {
      summary: payload.summary ?? '',
      keyFacts: payload.keyFacts ?? [],
    };
  }

  async generateOracle(request: {
    oracleType: 'npc_name' | 'location_name' | 'quest_hook';
    worldStateSummary?: string;
    scenarioTitle?: string;
    setting?: string;
  }) {
    const response = await fetch('/generate-oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oracle_type: request.oracleType,
        world_state_summary: request.worldStateSummary ?? '',
        scenario_title: request.scenarioTitle ?? '',
        setting: request.setting ?? '',
      }),
    });
    if (!response.ok) throw new Error(`Oracle generation failed: HTTP ${response.status}`);
    return generateOracleResponseSchema.parse(await response.json());
  }

  cancelGeneration(): void {
    this.activeChatAbortController?.abort();
    this.activeChatAbortController = null;
  }
}

function toDtoMessages(messages: ChatMessageDto[]): ChatMessageDto[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    input_type: message.input_type ?? 'dialogue',
  }));
}
