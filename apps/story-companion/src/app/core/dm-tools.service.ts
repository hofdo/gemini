import { Injectable } from '@angular/core';
import { npcSchema, type NpcDto } from '@nx-monorepo-experiment/shared-api-contracts';

export interface QuestDto {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  reward: string;
  difficulty?: string;
  setting?: string;
  partyLevel?: number | null;
}

@Injectable({ providedIn: 'root' })
export class DmToolsService {
  async generateQuest(
    prompt: string,
    partyLevel: number,
    setting?: string,
    tone?: string,
  ): Promise<QuestDto> {
    const response = await fetch('/generate-quest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        party_level: partyLevel,
        setting: setting ?? '',
        tone: tone ?? '',
      }),
    });
    if (!response.ok) {
      throw new Error(`Quest generation failed: HTTP ${response.status}`);
    }
    const raw = (await response.json()) as Record<string, unknown>;
    return {
      id: crypto.randomUUID(),
      title: String(raw['title'] ?? 'Untitled Quest'),
      description: String(raw['description'] ?? ''),
      objectives: Array.isArray(raw['objectives'])
        ? (raw['objectives'] as unknown[]).map(String)
        : [],
      reward: String(raw['reward'] ?? raw['rewards'] ?? ''),
      difficulty: raw['difficulty'] ? String(raw['difficulty']) : undefined,
      setting: raw['setting'] ? String(raw['setting']) : setting,
      partyLevel,
    };
  }

  async generateNpc(
    name: string,
    description: string,
    setting?: string,
    tone?: string,
  ): Promise<NpcDto> {
    const response = await fetch('/generate-npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npc_name: name,
        npc_description: description,
        setting: setting ?? '',
        tone: tone ?? '',
        title: '',
      }),
    });
    if (!response.ok) {
      throw new Error(`NPC generation failed: HTTP ${response.status}`);
    }
    return npcSchema.parse(await response.json());
  }
}
