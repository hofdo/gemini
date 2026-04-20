import { inject, Injectable } from '@angular/core';
import { InputType, Scenario, ScenarioType } from '../scenario/scenario.model';
import { ScenarioService } from '../scenario/scenario.service';
import { ChatMessage } from '../chat/chat.service';

@Injectable({ providedIn: 'root' })
export class AiAssistService {
  private scenarioService = inject(ScenarioService);

  async suggestInput(
    messages: ChatMessage[],
    inputType: InputType,
  ): Promise<string> {
    return this.callAssist('suggest', '', messages, inputType);
  }

  async rewriteInput(
    text: string,
    messages: ChatMessage[],
    inputType: InputType,
  ): Promise<string> {
    return this.callAssist('rewrite', text, messages, inputType);
  }

  async generateScenario(
    description: string,
    scenarioType: ScenarioType,
  ): Promise<Scenario> {
    const response = await fetch('/generate-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        scenario_type: scenarioType,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Map snake_case backend response to camelCase frontend model
    return {
      scenarioType: data.scenario_type ?? scenarioType,
      title: data.title ?? '',
      setting: data.setting ?? '',
      tone: data.tone ?? '',
      characterName: data.character_name ?? '',
      characterDescription: data.character_description ?? '',
      npcs: (data.npcs ?? []).map((n: { name: string; description: string }) => ({
        name: n.name,
        description: n.description,
      })),
      rules: data.rules ?? [],
      partnerName: data.partner_name ?? '',
      partnerDescription: data.partner_description ?? '',
      relationship: data.relationship ?? '',
    };
  }

  private async callAssist(
    mode: 'suggest' | 'rewrite',
    currentText: string,
    messages: ChatMessage[],
    inputType: InputType,
  ): Promise<string> {
    const scenario = this.scenarioService.activeScenario();

    const payload: Record<string, unknown> = {
      mode,
      current_text: currentText,
      input_type: inputType,
      messages: messages.map((m) => ({
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

    const response = await fetch('/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  }
}

