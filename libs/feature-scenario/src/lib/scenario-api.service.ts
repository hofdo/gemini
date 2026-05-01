import { Injectable } from '@angular/core';
import { Scenario, ScenarioType } from '@nx-monorepo-experiment/shared-scenario';
import { APP_CONFIG } from '@nx-monorepo-experiment/shared-config';

interface RawNpc {
  name: string;
  description: string;
  mode?: string;
  stats?: Record<string, number>;
  personality?: string;
  foes?: string[];
  friends?: string[];
  plot_twists?: string[];
}

@Injectable({ providedIn: 'root' })
export class ScenarioApiService {
  async generateScenario(
    description: string,
    scenarioType: ScenarioType,
  ): Promise<Scenario> {
    const response = await fetch('/generate-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
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
      npcs: (data.npcs ?? []).map((n: RawNpc) => ({
        name: n.name,
        description: n.description,
        mode: (n.mode as 'simple' | 'detailed') ?? 'simple',
        stats: n.stats,
        personality: n.personality ?? '',
        foes: n.foes ?? [],
        friends: n.friends ?? [],
        plotTwists: n.plot_twists ?? [],
      })),
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
    } as Scenario;
  }
}
