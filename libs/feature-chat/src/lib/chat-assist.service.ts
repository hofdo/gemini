import { inject, Injectable } from '@angular/core';
import { InputType, Npc } from '@nx-monorepo-experiment/shared-scenario';
import { ScenarioService } from '@nx-monorepo-experiment/shared-scenario';
import { APP_CONFIG } from '@nx-monorepo-experiment/shared-config';
import { ChatMessage } from './chat.service';

@Injectable({ providedIn: 'root' })
export class ChatAssistService {
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
            npcs: (scenario.npcs ?? []).map((n: Npc) => ({
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
          }
        : null,
    };

    const response = await fetch('/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  }
}
