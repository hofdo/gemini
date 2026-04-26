import { computed, inject, Injectable, signal } from '@angular/core';
import { InputType } from '../scenario/scenario.model';
import { ScenarioService } from '../scenario/scenario.service';
import { SettingsService } from '../shared/settings.service';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  inputType?: InputType;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private scenarioService = inject(ScenarioService);
  private settingsService = inject(SettingsService);
  private _abortController: AbortController | null = null;
  private readonly STORAGE_KEY = 'llama_chat_messages';

  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);

  readonly estimatedTokens = computed(() =>
    Math.round(this.messages().reduce((sum, m) => sum + m.content.length, 0) / 4),
  );
  readonly contextWarning = computed(() => this.estimatedTokens() > 3000);
  readonly contextCritical = computed(() => this.estimatedTokens() > 6000);

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
        this.messages.set(messages);
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

  initializeStory(): void {
    if (this.loading()) return;
    const scenario = this.scenarioService.activeScenario();
    if (!scenario || this.messages().length > 0) return;

    this.streamWithRetry({
      messages: [] as never[],
      stream: true,
      scenario: this.buildScenarioPayload(scenario),
      enable_thinking: this.settingsService.enableThinking(),
    });
  }

  sendMessage(content: string, inputType: InputType = 'dialogue'): void {
    if (this.loading()) return;
    this.messages.update((msgs) => [...msgs, { role: 'user' as const, content, inputType }]);

    const scenario = this.scenarioService.activeScenario();
    this.streamWithRetry({
      messages: this.messages().map((m) => ({
        role: m.role,
        content: m.content,
        input_type: m.inputType ?? 'dialogue',
      })),
      stream: true,
      scenario: scenario ? this.buildScenarioPayload(scenario) : null,
      enable_thinking: this.settingsService.enableThinking(),
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
      scenario: scenario ? this.buildScenarioPayload(scenario) : null,
      enable_thinking: this.settingsService.enableThinking(),
    });
  }

  private buildScenarioPayload(
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
    this.loading.set(true);
    this.messages.update((msgs) => [...msgs, { role: 'assistant' as const, content: '' }]);

    try {
      const response = await fetch(`${environment.apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: this._abortController.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('Response body is null');

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
          if (line.startsWith('data: [DONE]')) break;
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              const token: string = json.choices?.[0]?.delta?.content ?? '';
              if (token) this.appendToLastMessage(token);
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        this.messages.update((msgs) => msgs.slice(0, -1));
        return;
      }
      console.error('Stream error', err);
      this.appendToLastMessage('\n\n⚠️ Error during streaming.');
    } finally {
      this._abortController = null;
      this.loading.set(false);
      this.persistMessages();
    }
  }

  private async streamWithRetry(payload: Record<string, unknown>, retries = environment.retryAttempts): Promise<void> {
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
