import { Injectable } from '@angular/core';
import type { ChatMessageDto, ScenarioDto } from '@nx-monorepo-experiment/shared-api-contracts';
import type { InputMode } from './story-types';

export interface AdventureAssistRequest {
  mode: 'suggest' | 'rewrite';
  currentText: string;
  inputType: InputMode;
  scenario: ScenarioDto | null;
  messages: ChatMessageDto[];
}

@Injectable({ providedIn: 'root' })
export class AdventureAssistService {
  async assist(request: AdventureAssistRequest): Promise<string> {
    const response = await fetch('/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: request.mode,
        current_text: request.currentText,
        input_type: request.inputType,
        scenario: request.scenario,
        messages: request.messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`Assist failed: HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { text?: string };
    return payload.text?.trim() ?? '';
  }
}
