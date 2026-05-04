import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { scenarioSchema, type ScenarioDto } from '@nx-monorepo-experiment/shared-api-contracts';

@Component({
  selector: 'story-adventure-scenario-editor',
  imports: [FormsModule],
  templateUrl: './adventure-scenario-editor.component.html',
  styleUrl: './adventure-scenario-editor.component.scss',
})
export class AdventureScenarioEditorComponent {
  @Input() readonly = false;
  @Input() set scenario(value: ScenarioDto | null) {
    const next = value ? cloneScenario(value) : makeScenarioSeed();
    this.model.set(next);
    this.validityChange.emit(this.isValidScenario(next));
  }

  @Output() readonly scenarioChange = new EventEmitter<ScenarioDto>();
  @Output() readonly validityChange = new EventEmitter<boolean>();

  readonly model = signal<ScenarioDto>(makeScenarioSeed());

  update(): void {
    this.model.set(cloneScenario(this.model()));
    this.validateAndEmit();
  }

  clearForm(): void {
    this.model.set(makeScenarioSeed());
    this.validateAndEmit();
  }

  addNpc(): void {
    const next = cloneScenario(this.model());
    next.npcs.push({
      name: '',
      description: '',
      mode: 'simple',
      personality: '',
      friends: [],
      foes: [],
      plot_twists: [],
      stats: null,
    });
    this.model.set(next);
    this.validateAndEmit();
  }

  removeNpc(index: number): void {
    const next = cloneScenario(this.model());
    next.npcs.splice(index, 1);
    this.model.set(next);
    this.validateAndEmit();
  }

  addRule(): void {
    const next = cloneScenario(this.model());
    next.rules.push('');
    this.model.set(next);
    this.validateAndEmit();
  }

  removeRule(index: number): void {
    const next = cloneScenario(this.model());
    next.rules.splice(index, 1);
    this.model.set(next);
    this.validateAndEmit();
  }

  async generateNpcDetails(index: number): Promise<void> {
    const scenario = cloneScenario(this.model());
    const npc = scenario.npcs[index];
    if (!npc) return;
    const response = await fetch('/generate-npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npc_name: npc.name,
        npc_description: npc.description,
        setting: scenario.setting,
        tone: scenario.tone,
        title: scenario.title,
      }),
    });
    if (!response.ok) return;
    const generated = (await response.json()) as Partial<ScenarioDto['npcs'][number]>;
    scenario.npcs[index] = {
      ...npc,
      ...generated,
      name: npc.name || generated.name || '',
      description: npc.description || generated.description || '',
      mode: 'detailed',
    };
    this.model.set(scenario);
    this.validateAndEmit();
  }

  readListField(index: number, field: 'foes' | 'friends' | 'plot_twists'): string {
    const npc = this.model().npcs[index];
    if (!npc) return '';
    return (npc[field] ?? []).join(', ');
  }

  updateListField(index: number, field: 'foes' | 'friends' | 'plot_twists', value: string): void {
    const next = cloneScenario(this.model());
    const npc = next.npcs[index];
    if (!npc) return;
    npc[field] = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    this.model.set(next);
    this.validateAndEmit();
  }

  readStat(index: number, stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'): number | null {
    const npc = this.model().npcs[index];
    if (!npc?.stats) return null;
    return npc.stats[stat] ?? null;
  }

  updateStat(index: number, stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', value: string | number): void {
    const next = cloneScenario(this.model());
    const npc = next.npcs[index];
    if (!npc) return;
    npc.stats = npc.stats ?? {};
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      npc.stats[stat] = numeric;
    } else {
      delete npc.stats[stat];
    }
    this.model.set(next);
    this.validateAndEmit();
  }

  private validateAndEmit(): void {
    if (!this.isValidScenario(this.model())) {
      this.validityChange.emit(false);
      return;
    }
    const parsed = scenarioSchema.parse(this.model());
    this.validityChange.emit(true);
    this.scenarioChange.emit(parsed);
  }

  private isValidScenario(candidate: ScenarioDto): boolean {
    try {
      const parsed = scenarioSchema.parse(candidate);
      return [
        parsed.title,
        parsed.setting,
        parsed.tone,
        parsed.character_name,
        parsed.character_description,
      ].every((field) => field.trim().length > 0);
    } catch {
      return false;
    }
  }
}

function makeScenarioSeed(): ScenarioDto {
  return scenarioSchema.parse({
    scenario_type: 'adventure',
    title: '',
    setting: '',
    tone: '',
    character_name: '',
    character_description: '',
    npcs: [],
    rules: [],
  });
}

function cloneScenario(scenario: ScenarioDto): ScenarioDto {
  return JSON.parse(JSON.stringify(scenario)) as ScenarioDto;
}
