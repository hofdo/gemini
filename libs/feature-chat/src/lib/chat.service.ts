import { computed, inject, Injectable, signal } from '@angular/core';
import { InputType } from '@nx-monorepo-experiment/shared-scenario';
import { ScenarioService } from '@nx-monorepo-experiment/shared-scenario';
import { WorldStateService } from '@nx-monorepo-experiment/shared-world-state';
import { SettingsService } from '@nx-monorepo-experiment/shared-settings';
import { LoadingBusService } from '@nx-monorepo-experiment/shared-ui';
import { AppErrorService } from '@nx-monorepo-experiment/shared-ui';
import { APP_CONFIG } from '@nx-monorepo-experiment/shared-config';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inputType?: InputType;
  // Fix 3B: marks a message whose stream was interrupted mid-way
  failed?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private scenarioService = inject(ScenarioService);
  private settingsService = inject(SettingsService);
  private worldStateService = inject(WorldStateService);
  private loadingBus = inject(LoadingBusService);
  private appErrorService = inject(AppErrorService);
  private _abortController: AbortController | null = null;
  private readonly STORAGE_KEY = 'llama_chat_messages';
  private _lastStreamPayload: Record<string, unknown> | null = null;

  constructor() {
    this.appErrorService.registerRetryHandler(() => this.retryLastStream());
  }

  readonly messages = signal<ChatMessage[]>([]);

  readonly loading = computed(() => this.loadingBus.chatLoading());

  readonly estimatedTokens = computed(() =>
    Math.round(this.messages().reduce((sum, m) => sum + m.content.length, 0) / 4),
  );

  readonly systemPromptTokenEstimate = signal<number>(0);

  readonly contextWarning = computed(() => {
    const contextLimit = this.settingsService.contextWindow();
    return this.estimatedTokens() > contextLimit * 0.5;
  });
  readonly contextCritical = computed(() => {
    const contextLimit = this.settingsService.contextWindow();
    return this.estimatedTokens() > contextLimit * 0.75;
  });

  resetMessages(): void {
    this.messages.set([]);
    this.persistMessages();
  }

  loadPersistedMessages(): void {
    const scenario = this.scenarioService.activeScenario();
    if (!scenario) return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const { title, messages } = JSON.parse(raw);
      if (title === scenario.title) {
        // Fix 3B: back-fill id for messages persisted before this field was added
        const hydrated = (messages as ChatMessage[]).map(m =>
          m.id ? m : { ...m, id: crypto.randomUUID() }
        );
        this.messages.set(hydrated);
      }
    } catch {
      // ignore corrupt storage
    }
  }

  cancelStream(): void {
    this._abortController?.abort();
  }

  trimContext(keepLast = 10): void {
    const msgs = this.messages();
    if (msgs.length <= keepLast) return;
    this.messages.set(msgs.slice(msgs.length - keepLast));
    this.persistMessages();
  }

  autoArchiveIfNeeded(): void {
    const contextLimit = this.settingsService.contextWindow();
    if (this.estimatedTokens() <= contextLimit * 0.5) return;
    const msgs = this.messages();
    const keepCount = Math.ceil(msgs.length * 0.75);
    if (msgs.length <= keepCount) return;
    this.messages.set(msgs.slice(msgs.length - keepCount));
    this.persistMessages();
  }

  initializeStory(): void {
    if (this.loading()) return;
    const scenario = this.scenarioService.activeScenario();
    if (!scenario || this.messages().length > 0) return;

    this.streamWithRetry({
      messages: [] as never[],
      stream: true,
      stream_options: { include_usage: true },
      scenario: this.buildScenarioPayload(scenario),
      world_state: this.worldStateService.state() ?? null,
      enable_thinking: this.settingsService.enableThinking(),
    });
  }

  sendMessage(content: string, inputType: InputType = 'dialogue'): void {
    if (this.loading()) return;
    this.appErrorService.clear();
    this.messages.update((msgs) => [...msgs, { id: crypto.randomUUID(), role: 'user' as const, content, inputType }]);

    const scenario = this.scenarioService.activeScenario();
    this.streamWithRetry({
      messages: this.messages().map((m) => ({
        role: m.role,
        content: m.content,
        input_type: m.inputType ?? 'dialogue',
      })),
      stream: true,
      stream_options: { include_usage: true },
      scenario: scenario ? this.buildScenarioPayload(scenario) : null,
      world_state: this.worldStateService.state() ?? null,
      enable_thinking: this.settingsService.enableThinking(),
      tone_settings: this.settingsService.toneSettings(),
    });
  }

  regenerateLastResponse(): void {
    if (this.loading()) return;
    const msgs = this.messages();
    const lastAssistantIdx = [...msgs].reverse().findIndex((m) => m.role === 'assistant');
    if (lastAssistantIdx === -1) return;
    this.messages.set(msgs.slice(0, msgs.length - 1 - lastAssistantIdx));

    const scenario = this.scenarioService.activeScenario();
    this.streamWithRetry({
      messages: this.messages().map((m) => ({
        role: m.role,
        content: m.content,
        input_type: m.inputType ?? 'dialogue',
      })),
      stream: true,
      stream_options: { include_usage: true },
      scenario: scenario ? this.buildScenarioPayload(scenario) : null,
      world_state: this.worldStateService.state() ?? null,
      enable_thinking: this.settingsService.enableThinking(),
    });
  }

  buildScenarioPayload(
    scenario: NonNullable<ReturnType<ScenarioService['activeScenario']>>,
  ) {
    return {
      scenario_type: scenario.scenarioType ?? 'adventure',
      title: scenario.title,
      setting: scenario.setting,
      tone: scenario.tone,
      character_name: scenario.characterName,
      character_description: scenario.characterDescription,
      npcs: (scenario.npcs ?? []).map((n) => ({
        name: n.name,
        description: n.description,
        mode: n.mode ?? 'simple',
        stats: n.stats,
        personality: n.personality ?? '',
        foes: n.foes ?? [],
        friends: n.friends ?? [],
        plot_twists: n.plotTwists ?? [],
      })),
      rules: scenario.rules,
      partner_name: scenario.partnerName ?? '',
      partner_gender: scenario.partnerGender ?? '',
      partner_personality: scenario.partnerPersonality ?? '',
      partner_body_description: scenario.partnerBodyDescription ?? '',
      partner_appearance: scenario.partnerAppearance ?? '',
      partner_relationship: scenario.partnerRelationship ?? '',
      partner_likes: scenario.partnerLikes ?? '',
      partner_dislikes: scenario.partnerDislikes ?? '',
      partner_turn_ons: scenario.partnerTurnOns ?? '',
    };
  }

  private async streamRequest(payload: Record<string, unknown>): Promise<void> {
    this._abortController?.abort();
    this._abortController = new AbortController();
    this.loadingBus.set('chat', true);
    // Fix 3B: assign a stable ID so we can locate the message on error
    const pendingId = crypto.randomUUID();
    this.messages.update((msgs) => [...msgs, { id: pendingId, role: 'assistant' as const, content: '' }]);

    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: this._abortController.signal,
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 503 || status === 0) {
          this.appErrorService.set({ type: 'llm_unreachable', message: `HTTP ${status}` });
        } else {
          this.appErrorService.set({ type: 'parse_failure', message: `HTTP ${status}` });
        }
        this.messages.update((msgs) => msgs.slice(0, -1));
        return;
      }
      if (!response.body) throw new Error('Response body is null');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let usageSet = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: [DONE]')) break;
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              const token: string = json.choices?.[0]?.delta?.content ?? '';
              if (token) this.appendToLastMessage(token);
              if (!usageSet && json.usage?.prompt_tokens) {
                this.systemPromptTokenEstimate.set(json.usage.prompt_tokens);
                usageSet = true;
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      }

      this.autoArchiveIfNeeded();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        this.messages.update((msgs) => msgs.slice(0, -1));
        return;
      }
      console.error('Stream error', err);
      this.appErrorService.set({ type: 'llm_unreachable', message: String(err) });
      // Fix 3B: mark the pending message as failed rather than silently removing it,
      // so the user can see partial content with a clear failure indicator.
      this.messages.update((msgs) =>
        msgs.map(m => m.id === pendingId ? { ...m, failed: true } : m)
      );
    } finally {
      this._abortController = null;
      this.loadingBus.set('chat', false);
      this.persistMessages();
    }
  }

  // Fix 3A: re-send the last failed stream (called by App on error-boundary retry)
  retryLastStream(): void {
    if (!this._lastStreamPayload || this.loading()) return;
    this.appErrorService.clear();
    // Remove any failed/empty trailing assistant message before retrying
    this.messages.update(msgs => {
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && (last.failed || last.content === '')) {
        return msgs.slice(0, -1);
      }
      return msgs;
    });
    void this.streamWithRetry(this._lastStreamPayload);
  }

  private async streamWithRetry(payload: Record<string, unknown>, retries = APP_CONFIG.retryAttempts): Promise<void> {
    this._lastStreamPayload = payload;
    for (let i = 0; i <= retries; i++) {
      try {
        return await this.streamRequest(payload);
      } catch (err) {
        if (i === retries) throw err;
        console.warn(`Stream attempt ${i + 1} failed, retrying...`, err);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  private appendToLastMessage(token: string): void {
    this.messages.update((msgs) => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, content: last.content + token };
      return updated;
    });
  }

  private persistMessages(): void {
    const scenario = this.scenarioService.activeScenario();
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({ title: scenario?.title ?? '', messages: this.messages() }),
      );
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }
}
