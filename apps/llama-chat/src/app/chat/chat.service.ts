import { inject, Injectable, signal } from '@angular/core';
import { InputType } from '../scenario/scenario.model';
import { ScenarioService } from '../scenario/scenario.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  inputType?: InputType;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private scenarioService = inject(ScenarioService);

  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);

  resetMessages(): void {
    this.messages.set([]);
  }

  initializeStory(): void {
    const scenario = this.scenarioService.activeScenario();
    if (!scenario || this.messages().length > 0 || this.loading()) return;

    const payload = {
      messages: [] as never[],
      stream: true,
      scenario: this.buildScenarioPayload(scenario),
    };

    this.streamRequest(payload);
  }

  sendMessage(content: string, inputType: InputType = 'dialogue'): void {
    const userMsg: ChatMessage = { role: 'user', content, inputType };
    this.messages.update((msgs) => [...msgs, userMsg]);

    const scenario = this.scenarioService.activeScenario();

    const payload = {
      messages: this.messages().map((m) => ({
        role: m.role,
        content: m.content,
        input_type: m.inputType ?? 'dialogue',
      })),
      stream: true,
      scenario: scenario ? this.buildScenarioPayload(scenario) : null,
    };

    this.streamRequest(payload);
  }

  private buildScenarioPayload(scenario: NonNullable<ReturnType<ScenarioService['activeScenario']>>) {
    return {
      scenario_type: scenario.scenarioType ?? 'adventure',
      title: scenario.title,
      setting: scenario.setting,
      tone: scenario.tone,
      character_name: scenario.characterName,
      character_description: scenario.characterDescription,
      npcs: scenario.npcs,
      rules: scenario.rules,
      partner_name: scenario.partnerName ?? '',
      partner_description: scenario.partnerDescription ?? '',
      relationship: scenario.relationship ?? '',
    };
  }

  private async streamRequest(payload: Record<string, unknown>): Promise<void> {
    this.loading.set(true);

    // Add placeholder assistant message
    this.messages.update((msgs) => [...msgs, { role: 'assistant' as const, content: '' }]);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: [DONE]')) {
            break;
          }
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              const token: string = json.choices?.[0]?.delta?.content ?? '';
              if (token) {
                this.appendToLastMessage(token);
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }
      }
    } catch (err) {
      console.error('Stream error', err);
      this.appendToLastMessage('\n\n⚠️ Error during streaming.');
    } finally {
      this.loading.set(false);
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
}
