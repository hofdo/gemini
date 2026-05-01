import { Injectable } from '@angular/core';
import { APP_CONFIG } from '@nx-monorepo-experiment/shared-config';

/** Raw JSON shape returned by the /generate-npc endpoint. */
export interface GeneratedNpc {
  name?: string;
  race?: string;
  description?: string;
  personality?: string;
  alignment?: string;
  cr?: string;
  classes?: Array<{ name: string; level: number }>;
  stats?: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number };
  saving_throws?: string[];
  skills?: string[];
  equipment?: string[];
  actions?: Array<{ name: string; description: string }>;
  foes?: string[];
  friends?: string[];
  plot_twists?: string[];
}

@Injectable({ providedIn: 'root' })
export class NpcApiService {
  async generateNpc(
    npcName: string,
    npcDescription: string,
    setting: string,
    tone: string,
    title: string,
  ): Promise<GeneratedNpc> {
    const response = await fetch('/generate-npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
      body: JSON.stringify({ npc_name: npcName, npc_description: npcDescription, setting, tone, title }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}
