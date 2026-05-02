import { Component, computed, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { scenarioSchema, type ScenarioDto } from '@nx-monorepo-experiment/shared-api-contracts';
import { AdventureScenarioEditorComponent } from '../scenario-editor/adventure-scenario-editor.component';
import { StorySessionService } from '../../core/story-session.service';
import type { ProviderMode } from '../../core/story-types';
import { PresetScenarioService, type ScenarioPresetMeta } from '../../core/preset-scenario.service';

@Component({
  selector: 'story-scenario-wizard',
  imports: [FormsModule, SlicePipe, AdventureScenarioEditorComponent],
  templateUrl: './scenario-wizard.component.html',
  styleUrl: './scenario-wizard.component.scss',
})
export class ScenarioWizardComponent {
  private readonly story = inject(StorySessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly presetsService = inject(PresetScenarioService);

  readonly prompt = signal('A tense fantasy opening where a barred city gate hides a political secret.');
  readonly scenarioType = 'adventure' as const;
  readonly generatedScenario = signal<ScenarioDto | null>(null);
  readonly scenarioJson = signal('');
  readonly presets = signal<ScenarioPresetMeta[]>([]);
  readonly selectedPresetPath = signal('');
  readonly advancedOpen = signal(false);
  readonly editorValid = signal(false);
  readonly editSessionId = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly providerMode = this.story.providerMode;
  readonly loading = this.story.loading;
  readonly error = this.story.error;
  readonly sessions = this.story.sessions;

  readonly canConfirm = computed(() => this.generatedScenario() !== null && this.editorValid() && !this.loading());

  constructor() {
    void this.story.hydrate();
    void this.loadPresets();
    const editingSession = this.route.snapshot.queryParamMap.get('edit');
    if (editingSession) {
      this.editSessionId.set(editingSession);
      void this.story.loadSession(editingSession).then((session) => {
        if (!session) return;
        this.generatedScenario.set(session.scenario);
        this.scenarioJson.set(JSON.stringify(session.scenario, null, 2));
        this.editorValid.set(true);
      });
    }
  }

  setProvider(mode: ProviderMode): void {
    void this.story.setProviderMode(mode);
  }

  async generate(): Promise<void> {
    this.validationError.set(null);
    const scenario = await this.story.generateScenario(this.prompt(), this.scenarioType);
    this.generatedScenario.set(scenario);
    this.scenarioJson.set(JSON.stringify(scenario, null, 2));
    this.editorValid.set(true);
  }

  validateJson(): void {
    try {
      const parsed = scenarioSchema.parse(JSON.parse(this.scenarioJson()));
      this.generatedScenario.set(parsed);
      this.editorValid.set(true);
      this.validationError.set(null);
    } catch (error) {
      this.editorValid.set(false);
      this.validationError.set(error instanceof Error ? error.message : String(error));
    }
  }

  async confirm(): Promise<void> {
    this.validateJson();
    const scenario = this.generatedScenario();
    if (!scenario || this.validationError()) return;
    const editSessionId = this.editSessionId();
    if (editSessionId) {
      const choice = window.prompt('Type "reset" to apply and reset messages, "new" to save as new session, or anything else to cancel.');
      if (choice === 'reset') {
        const session = await this.story.updateSessionScenario(editSessionId, scenario, true);
        await this.router.navigate(['/workspace', session.id]);
      } else if (choice === 'new') {
        const session = await this.story.createSession(scenario);
        await this.router.navigate(['/workspace', session.id]);
      }
      return;
    }
    const session = await this.story.createSession(scenario);
    await this.router.navigate(['/workspace', session.id]);
  }

  async openSession(id: string): Promise<void> {
    await this.router.navigate(['/workspace', id]);
  }

  onScenarioChange(scenario: ScenarioDto): void {
    this.generatedScenario.set(scenario);
    this.scenarioJson.set(JSON.stringify(scenario, null, 2));
    this.validationError.set(null);
  }

  onValidityChange(valid: boolean): void {
    this.editorValid.set(valid);
  }

  toggleAdvanced(): void {
    this.advancedOpen.set(!this.advancedOpen());
  }

  async loadPresetByPath(path: string): Promise<void> {
    this.selectedPresetPath.set(path);
    const preset = this.presets().find((entry) => entry.path === path);
    if (!preset) return;
    const scenario = await this.presetsService.loadScenario(preset);
    this.generatedScenario.set(scenario);
    this.scenarioJson.set(JSON.stringify(scenario, null, 2));
    this.editorValid.set(true);
    this.validationError.set(null);
  }

  private async loadPresets(): Promise<void> {
    const presets = await this.presetsService.loadIndex();
    this.presets.set(presets);
  }
}
