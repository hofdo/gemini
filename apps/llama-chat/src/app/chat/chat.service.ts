import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { InputType, Scenario } from '../scenario/scenario.model';
import { ScenarioService } from '../scenario/scenario.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  inputType?: InputType;
}

interface ChatResponse {
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private scenarioService = inject(ScenarioService);

  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);

  resetMessages(): void {
    this.messages.set([]);
  }

  sendMessage(content: string, inputType: InputType = 'dialogue'): void {
    const userMsg: ChatMessage = { role: 'user', content, inputType };
    this.messages.update((msgs) => [...msgs, userMsg]);
    this.loading.set(true);

    const scenario = this.scenarioService.activeScenario();

    const payload = {
      messages: this.messages().map((m) => ({
        role: m.role,
        content: m.content,
        input_type: m.inputType ?? 'dialogue',
      })),
      scenario: scenario
        ? {
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
          }
        : null,
    };

    this.http
      .post<ChatResponse>('/chat', payload)
      .subscribe({
        next: (res) => {
          this.messages.update((msgs) => [
            ...msgs,
            { role: 'assistant', content: res.reply },
          ]);
        },
        error: (err) => {
          console.error('Chat error', err);
          this.messages.update((msgs) => [
            ...msgs,
            { role: 'assistant', content: '⚠️ Error reaching the backend.' },
          ]);
        },
        complete: () => this.loading.set(false),
      });
  }
}

