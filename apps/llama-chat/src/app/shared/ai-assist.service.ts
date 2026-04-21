import { inject, Injectable } from '@angular/core';
import { InputType, Npc, Scenario, ScenarioType } from '../scenario/scenario.model';
import { ScenarioService } from '../scenario/scenario.service';
import { ChatMessage } from '../chat/chat.service';
import type { Quest, QuestEncounter, QuestMonster } from '../dm/dm.model';

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

    return {
      scenarioType: data.scenario_type ?? scenarioType,
      title: data.title ?? '',
      setting: data.setting ?? '',
      tone: data.tone ?? '',
      characterName: data.character_name ?? '',
      characterDescription: data.character_description ?? '',
      npcs: (data.npcs ?? []).map(
        (n: { name: string; description: string; mode?: string; stats?: Record<string, number>;
               personality?: string; foes?: string[]; friends?: string[]; plot_twists?: string[] }) => ({
          name: n.name,
          description: n.description,
          mode: (n.mode as 'simple' | 'detailed') ?? 'simple',
          stats: n.stats,
          personality: n.personality ?? '',
          foes: n.foes ?? [],
          friends: n.friends ?? [],
          plotTwists: n.plot_twists ?? [],
        }),
      ),
      rules: data.rules ?? [],
      partnerName: data.partner_name ?? '',
      partnerGender: data.partner_gender ?? '',
      partnerPersonality: data.partner_personality ?? '',
      partnerBodyDescription: data.partner_body_description ?? '',
      partnerAppearance: data.partner_appearance ?? '',
      partnerRelationship: data.partner_relationship ?? '',
      partnerLikes: data.partner_likes ?? '',
      partnerDislikes: data.partner_dislikes ?? '',
      partnerTurnOns: data.partner_turn_ons ?? '',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generateNpc(
    npcName: string,
    npcDescription: string,
    setting: string,
    tone: string,
    title: string,
  ): Promise<any> {
    const response = await fetch('/generate-npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npc_name: npcName,
        npc_description: npcDescription,
        setting,
        tone,
        title,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async generateQuest(
    prompt: string,
    setting?: string,
    tone?: string,
    partyLevel?: number | null,
  ): Promise<Quest> {
    const response = await fetch('/generate-quest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        setting: setting ?? '',
        tone: tone ?? '',
        party_level: partyLevel ?? null,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const d = await response.json();
    return {
      id: crypto.randomUUID(),
      title: d.title ?? '',
      description: d.description ?? '',
      objectives: d.objectives ?? [],
      rewards: {
        gold: d.rewards?.gold ?? 0,
        silver: d.rewards?.silver ?? 0,
        items: d.rewards?.items ?? [],
      },
      encounters: (d.encounters ?? []).map((e: { description?: string; monsters?: { name?: string; cr?: string }[] }): QuestEncounter => ({
        description: e.description ?? '',
        monsters: (e.monsters ?? []).map((m): QuestMonster => ({
          name: m.name ?? '',
          cr: m.cr ?? '—',
        })),
      })),
      difficulty: d.difficulty ?? 'Medium',
      setting: d.setting ?? '',
      estimatedDuration: d.estimated_duration ?? '',
      partyLevel: d.party_level ?? partyLevel ?? null,
      xpBudget: d.xp_budget ?? null,
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
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  }
}
