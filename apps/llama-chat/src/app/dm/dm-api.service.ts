import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type { GeneratedNpcRaw, Quest, QuestEncounter, QuestMonster } from './dm.model';

@Injectable({ providedIn: 'root' })
export class DmApiService {
  async generateNpc(
    npcName: string,
    npcDescription: string,
    setting: string,
    tone: string,
    title: string,
  ): Promise<GeneratedNpcRaw> {
    const response = await fetch('/generate-npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(environment.timeoutMs),
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
      signal: AbortSignal.timeout(environment.timeoutMs),
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
