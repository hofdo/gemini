import { computed, inject, Injectable, signal } from '@angular/core';
import type { ScenarioDto } from '@nx-monorepo-experiment/shared-api-contracts';
import { StoryProviderService } from './story-provider.service';
import { StorySessionRepository } from './session.repository';
import {
  makeAssistantMessage,
  makeEmptyWorldState,
  makeStorySession,
  makeUserMessage,
  newId,
  nowIso,
} from './story-factories';
import type { InputMode, ProviderMode, StoryOracleResult, StorySession } from './story-types';
import { appendSessionSummary, applyWorldDelta, normalizeWorldState } from './world-delta';

@Injectable({ providedIn: 'root' })
export class StorySessionService {
  private readonly providers = inject(StoryProviderService);
  private readonly repository = inject(StorySessionRepository);
  private cancelRequested = false;

  readonly activeSession = signal<StorySession | null>(null);
  readonly providerMode = signal<ProviderMode>('local');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sessions = signal<StorySession[]>([]);

  readonly hasActiveSession = computed(() => this.activeSession() !== null);

  async hydrate(): Promise<void> {
    this.sessions.set(await this.repository.listSessions());
  }

  async generateScenario(prompt: string, scenarioType: 'adventure'): Promise<ScenarioDto> {
    this.loading.set(true);
    this.error.set(null);
    try {
      return await this.providers.forMode(this.providerMode()).generateScenario({ prompt, scenarioType });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async createSession(scenario: ScenarioDto): Promise<StorySession> {
    const session = makeStorySession({
      providerMode: this.providerMode(),
      scenario,
      title: scenario.title,
      worldState: makeEmptyWorldState(newId('world'), scenario.title, scenario),
    });
    await this.repository.saveSession(session);
    this.activeSession.set(session);
    await this.hydrate();
    return session;
  }

  async loadSession(id: string): Promise<StorySession | null> {
    const session = await this.repository.getSession(id);
    if (session && session.scenario) {
      session.worldState = normalizeWorldState(session.worldState, session.scenario);
    }
    this.activeSession.set(session ?? null);
    if (session) this.providerMode.set(session.providerMode);
    return session ?? null;
  }

  async setProviderMode(mode: ProviderMode): Promise<void> {
    this.providerMode.set(mode);
    const session = this.activeSession();
    if (!session) return;
    await this.saveSession({ ...session, providerMode: mode });
  }

  async sendMessage(content: string, inputType: InputMode): Promise<void> {
    const session = this.activeSession();
    if (!session || this.loading()) return;

    this.loading.set(true);
    this.cancelRequested = false;
    this.error.set(null);
    const userMessage = makeUserMessage(content, inputType);
    const assistantMessage = makeAssistantMessage();
    let nextSession = {
      ...session,
      messages: [...session.messages, userMessage, assistantMessage],
      updatedAt: nowIso(),
    };
    this.activeSession.set(nextSession);

    try {
      const provider = this.providers.forMode(nextSession.providerMode);
      for await (const token of provider.streamChat({
        session: nextSession,
        messages: nextSession.messages,
      })) {
        if (this.cancelRequested) break;
        nextSession = appendToAssistant(nextSession, assistantMessage.id, token);
        this.activeSession.set(nextSession);
      }

      if (this.cancelRequested) {
        nextSession = {
          ...nextSession,
          messages: nextSession.messages.filter(
            (message) => message.id !== assistantMessage.id || message.content.trim().length > 0,
          ),
          updatedAt: nowIso(),
        };
        this.activeSession.set(nextSession);
        await this.saveSession(nextSession);
        return;
      }

      const delta = await provider.extractWorldDelta({
        session: nextSession,
        messages: nextSession.messages,
      });
      if (this.cancelRequested) {
        await this.saveSession(nextSession);
        return;
      }
      nextSession = {
        ...nextSession,
        worldState: applyWorldDelta(nextSession.worldState, delta),
        updatedAt: nowIso(),
      };
      const userTurns = nextSession.messages.filter((message) => message.role === 'user').length;
      if (userTurns > 0 && userTurns % 20 === 0) {
        const summary = await provider.summarizeSession({
          session: nextSession,
          messages: nextSession.messages,
        });
        nextSession = {
          ...nextSession,
          worldState: appendSessionSummary(nextSession.worldState, userTurns, summary),
        };
      }
      await this.saveSession(nextSession);
    } catch (error) {
      const abortError = error instanceof Error && error.name === 'AbortError';
      nextSession = {
        ...nextSession,
        messages: abortError
          ? nextSession.messages.filter(
              (message) => message.id !== assistantMessage.id || message.content.trim().length > 0,
            )
          : nextSession.messages.map((message) =>
              message.id === assistantMessage.id ? { ...message, failed: true } : message,
            ),
      };
      this.activeSession.set(nextSession);
      await this.saveSession(nextSession);
      if (!abortError) {
        this.error.set(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.loading.set(false);
      this.cancelRequested = false;
    }
  }

  cancelGeneration(): void {
    const session = this.activeSession();
    if (!session) return;
    this.cancelRequested = true;
    this.providers.forMode(session.providerMode).cancelGeneration();
  }

  async regenerateLastResponse(): Promise<void> {
    const session = this.activeSession();
    if (!session || this.loading()) return;
    const lastUserIndex = findLastUserIndex(session.messages);
    if (lastUserIndex === -1) return;
    const lastUser = session.messages[lastUserIndex];

    const trimmed = {
      ...session,
      messages: session.messages.slice(0, lastUserIndex),
      updatedAt: nowIso(),
    };
    await this.saveSession(trimmed);
    await this.sendMessage(lastUser.content, lastUser.input_type);
  }

  async retryLastResponse(): Promise<void> {
    const session = this.activeSession();
    if (!session || this.loading()) return;
    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.failed) return;
    await this.regenerateLastResponse();
  }

  async resetCurrentStory(): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    await this.saveSession({
      ...session,
      messages: [],
      worldState: makeEmptyWorldState(session.worldState.id ?? newId('world'), session.scenario.title, session.scenario),
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.repository.deleteSession(id);
    if (this.activeSession()?.id === id) {
      this.activeSession.set(null);
    }
    await this.hydrate();
  }

  async updateSessionScenario(sessionId: string, scenario: ScenarioDto, resetMessages: boolean): Promise<StorySession> {
    const existing = await this.repository.getSession(sessionId);
    if (!existing) {
      throw new Error('Session not found');
    }
    const updated: StorySession = {
      ...existing,
      title: scenario.title,
      scenario,
      messages: resetMessages ? [] : existing.messages,
      worldState: resetMessages
        ? makeEmptyWorldState(existing.worldState.id ?? newId('world'), scenario.title, scenario)
        : existing.worldState,
      updatedAt: nowIso(),
    };
    await this.saveSession(updated);
    return updated;
  }

  async trimContext(keepLast: number): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    const safeKeep = Math.max(1, Math.floor(keepLast));
    await this.saveSession({
      ...session,
      messages: session.messages.slice(-safeKeep),
    });
  }

  exportSessionToJson(): string {
    const session = this.activeSession();
    if (!session) return '';
    return JSON.stringify({
      id: session.id,
      title: session.title,
      scenario: session.scenario,
      messages: session.messages,
      world_state: session.worldState,
      provider_mode: session.providerMode,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    }, null, 2);
  }

  async exportAndReset(): Promise<void> {
    await this.resetCurrentStory();
  }

  async addQuestToSession(quest: { id: string; title: string; status?: string }): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    const entry = { id: quest.id, title: quest.title, status: quest.status ?? 'active' };
    const questLog = [...(session.worldState.questLog ?? []).filter((q) => q.id !== quest.id), entry];
    await this.saveSession({ ...session, worldState: { ...session.worldState, questLog } });
  }

  async addNpcToSession(npc: { npcId: string; name: string; status?: string; disposition?: number }): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    const entry = {
      npcId: npc.npcId,
      name: npc.name,
      status: npc.status ?? 'alive',
      disposition: npc.disposition ?? 0,
    };
    const npcStates = [...(session.worldState.npcStates ?? []).filter((n) => n.npcId !== npc.npcId), entry];
    await this.saveSession({ ...session, worldState: { ...session.worldState, npcStates } });
  }

  async setCombatState(combat: StorySession['worldState']['combat']): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    await this.saveSession({ ...session, worldState: { ...session.worldState, combat } });
  }

  async appendWorldEvent(event: { id: string; title: string; description: string; type: string; turn: number }): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    const events = [...(session.worldState.events ?? []), event];
    await this.saveSession({ ...session, worldState: { ...session.worldState, events } });
  }

  async generateOracle(type: 'npc_name' | 'location_name' | 'quest_hook'): Promise<StoryOracleResult> {
    const session = this.activeSession();
    if (!session) {
      throw new Error('No active session');
    }
    return this.providers.forMode(session.providerMode).generateOracle({
      oracleType: type,
      scenarioTitle: session.scenario.title,
      setting: session.scenario.setting,
      worldStateSummary: (session.worldState.keyFacts ?? []).slice(-8).join(' | '),
    });
  }

  private async saveSession(session: StorySession): Promise<void> {
    const next = { ...session, updatedAt: nowIso() };
    await this.repository.saveSession(next);
    this.activeSession.set(next);
    await this.hydrate();
  }
}

function findLastUserIndex(messages: StorySession['messages']): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === 'user') return index;
  }
  return -1;
}

function appendToAssistant(session: StorySession, id: string, token: string): StorySession {
  return {
    ...session,
    messages: session.messages.map((message) =>
      message.id === id ? { ...message, content: message.content + token } : message,
    ),
  };
}
