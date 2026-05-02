import { Injectable } from '@angular/core';
import { scenarioSchema, type ScenarioDto } from '@nx-monorepo-experiment/shared-api-contracts';
import { z } from 'zod';

export interface ScenarioPresetMeta {
  id: string;
  label: string;
  path: string;
}

@Injectable({ providedIn: 'root' })
export class PresetScenarioService {
  async loadIndex(): Promise<ScenarioPresetMeta[]> {
    const response = await fetch('/scenarios/index.json');
    if (!response.ok) return [];
    const parsed = presetIndexSchema.parse(await response.json());
    return parsed.filter((entry) => entry.path.startsWith('scenarios/adventure/'));
  }

  async loadScenario(meta: { path: string }): Promise<ScenarioDto> {
    const response = await fetch(`/${meta.path}`);
    if (!response.ok) {
      throw new Error(`Preset not found: ${meta.path}`);
    }
    return scenarioSchema.parse(await response.json());
  }
}

const presetIndexSchema = z.array(z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
}));
