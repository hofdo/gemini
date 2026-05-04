import { Component, computed, effect, inject, signal } from '@angular/core';
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
  private static readonly defaultPrompt = 'A tense fantasy opening where a barred city gate hides a political secret.';
  private readonly story = inject(StorySessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly presetsService = inject(PresetScenarioService);
  private restoringDraft = false;
  private loadedEditSession = false;

  readonly prompt = signal(ScenarioWizardComponent.defaultPrompt);
  readonly scenarioType = 'adventure' as const;
  readonly generatedScenario = signal<ScenarioDto | null>(null);
  readonly scenarioJson = signal('');
  readonly presets = signal<ScenarioPresetMeta[]>([]);
  readonly selectedPresetPath = signal('');
  readonly advancedOpen = signal(false);
  readonly editorValid = signal(false);
  readonly editSessionId = signal<string | null>(null);
  readonly saveMode = signal<'current' | 'new'>('current');
  readonly recoveryNoticeVisible = signal(false);
  readonly validationError = signal<string | null>(null);
  readonly baselineScenario = signal<ScenarioDto | null>(null);
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
      const restored = this.restoreDraft();
      if (!restored) {
        void this.story.loadSession(editingSession).then((session) => {
          if (!session || this.loadedEditSession) return;
          const scenario = cloneScenario(session.scenario);
          this.loadedEditSession = true;
          this.generatedScenario.set(scenario);
          this.baselineScenario.set(cloneScenario(scenario));
          this.scenarioJson.set(JSON.stringify(scenario, null, 2));
          this.editorValid.set(true);
        });
      }
    } else {
      this.restoreDraft();
    }

    effect(() => {
      if (this.restoringDraft) return;
      this.persistDraft();
    });
  }

  setProvider(mode: ProviderMode): void {
    void this.story.setProviderMode(mode);
  }

  async generate(): Promise<void> {
    this.validationError.set(null);
    const scenario = await this.story.generateScenario(this.prompt(), this.scenarioType);
    this.generatedScenario.set(scenario);
    this.baselineScenario.set(cloneScenario(scenario));
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
      if (this.saveMode() === 'current') {
        const session = await this.story.updateSessionScenario(editSessionId, scenario, true);
        this.clearPersistedDraft();
        await this.router.navigate(['/workspace', session.id]);
      } else {
        const session = await this.story.createSession(scenario);
        this.clearPersistedDraft();
        await this.router.navigate(['/workspace', session.id]);
      }
      return;
    }
    const session = await this.story.createSession(scenario);
    this.clearPersistedDraft();
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

  clearPrompt(): void {
    this.prompt.set('');
  }

  resetScenarioEdits(): void {
    const baseline = this.baselineScenario();
    if (!baseline) {
      this.generatedScenario.set(null);
      this.scenarioJson.set('');
      this.editorValid.set(false);
      this.validationError.set(null);
      return;
    }
    const scenario = cloneScenario(baseline);
    this.generatedScenario.set(scenario);
    this.scenarioJson.set(JSON.stringify(scenario, null, 2));
    this.editorValid.set(true);
    this.validationError.set(null);
  }

  keepRecoveredDraft(): void {
    this.recoveryNoticeVisible.set(false);
  }

  discardRecoveredDraft(): void {
    this.restoringDraft = true;
    this.prompt.set(ScenarioWizardComponent.defaultPrompt);
    this.generatedScenario.set(null);
    this.baselineScenario.set(null);
    this.scenarioJson.set('');
    this.selectedPresetPath.set('');
    this.advancedOpen.set(false);
    this.editorValid.set(false);
    this.validationError.set(null);
    this.recoveryNoticeVisible.set(false);
    this.restoringDraft = false;
    this.clearPersistedDraft();
  }

  async loadPresetByPath(path: string): Promise<void> {
    this.selectedPresetPath.set(path);
    const preset = this.presets().find((entry) => entry.path === path);
    if (!preset) return;
    const scenario = await this.presetsService.loadScenario(preset);
    this.generatedScenario.set(scenario);
    this.baselineScenario.set(cloneScenario(scenario));
    this.scenarioJson.set(JSON.stringify(scenario, null, 2));
    this.editorValid.set(true);
    this.validationError.set(null);
  }

  private async loadPresets(): Promise<void> {
    const presets = await this.presetsService.loadIndex();
    this.presets.set(presets);
  }

  private storageKey(): string {
    return `story-companion:wizard:${this.editSessionId() ?? 'new-session'}`;
  }

  private persistDraft(): void {
    const snapshot: WizardDraftSnapshot = {
      prompt: this.prompt(),
      selectedPresetPath: this.selectedPresetPath(),
      advancedOpen: this.advancedOpen(),
      scenarioJson: this.scenarioJson(),
      generatedScenario: this.generatedScenario(),
      baselineScenario: this.baselineScenario(),
      editorValid: this.editorValid(),
      saveMode: this.saveMode(),
    };
    safeStorageSet(this.storageKey(), JSON.stringify(snapshot));
  }

  private restoreDraft(): boolean {
    const raw = safeStorageGet(this.storageKey());
    if (!raw) return false;
    try {
      const snapshot = JSON.parse(raw) as Partial<WizardDraftSnapshot>;
      this.restoringDraft = true;
      this.prompt.set(typeof snapshot.prompt === 'string' ? snapshot.prompt : ScenarioWizardComponent.defaultPrompt);
      this.selectedPresetPath.set(typeof snapshot.selectedPresetPath === 'string' ? snapshot.selectedPresetPath : '');
      this.advancedOpen.set(Boolean(snapshot.advancedOpen));
      this.scenarioJson.set(typeof snapshot.scenarioJson === 'string' ? snapshot.scenarioJson : '');
      const parsedScenario = parseScenario(snapshot.generatedScenario ?? null);
      const parsedBaseline = parseScenario(snapshot.baselineScenario ?? null);
      this.generatedScenario.set(parsedScenario);
      this.baselineScenario.set(parsedBaseline ?? parsedScenario);
      this.editorValid.set(Boolean(snapshot.editorValid));
      if (snapshot.saveMode === 'new' || snapshot.saveMode === 'current') {
        this.saveMode.set(snapshot.saveMode);
      }
      this.validationError.set(null);
      this.recoveryNoticeVisible.set(true);
      this.loadedEditSession = parsedScenario !== null;
      return true;
    } catch {
      this.clearPersistedDraft();
      return false;
    } finally {
      this.restoringDraft = false;
    }
  }

  private clearPersistedDraft(): void {
    safeStorageRemove(this.storageKey());
  }
}

interface WizardDraftSnapshot {
  prompt: string;
  selectedPresetPath: string;
  advancedOpen: boolean;
  scenarioJson: string;
  generatedScenario: ScenarioDto | null;
  baselineScenario: ScenarioDto | null;
  editorValid: boolean;
  saveMode: 'current' | 'new';
}

function cloneScenario(scenario: ScenarioDto): ScenarioDto {
  return JSON.parse(JSON.stringify(scenario)) as ScenarioDto;
}

function parseScenario(value: unknown): ScenarioDto | null {
  if (!value) return null;
  try {
    return scenarioSchema.parse(value);
  } catch {
    return null;
  }
}

function safeStorageGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Ignore storage failures so the wizard still works in constrained browsers.
  }
}

function safeStorageRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Ignore storage failures so the wizard still works in constrained browsers.
  }
}
