import { Injectable } from '@angular/core';
import { Scenario, ScenarioType } from './scenario.model';

export interface PresetMeta {
  id: string;
  label: string;
  type: ScenarioType;
}

@Injectable({ providedIn: 'root' })
export class PresetScenarioService {
  async loadIndex(): Promise<PresetMeta[]> {
    const res = await fetch('/scenarios/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async loadScenario(meta: PresetMeta): Promise<Scenario> {
    const res = await fetch(`/scenarios/${meta.type}/${meta.id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
