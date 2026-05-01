import { inject, Injectable } from '@angular/core';
import type { Quest, QuestEncounter, QuestMonster } from './dm.model';
import { APP_CONFIG } from '@nx-monorepo-experiment/shared-config';
import { NpcApiService } from '@nx-monorepo-experiment/shared-scenario';

@Injectable({ providedIn: 'root' })
export class DmApiService {
  private readonly npcApiService = inject(NpcApiService);

  generateNpc(
    npcName: string,
    npcDescription: string,
    setting: string,
    tone: string,
    title: string,
  ) {
    return this.npcApiService.generateNpc(npcName, npcDescription, setting, tone, title);
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
      signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
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
}
