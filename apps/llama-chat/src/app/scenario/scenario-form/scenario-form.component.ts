import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ScenarioService } from '../scenario.service';
import { AiAssistService } from '../../shared/ai-assist.service';
import { Scenario, ScenarioType } from '../scenario.model';

@Component({
  selector: 'llama-scenario-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './scenario-form.component.html',
  styleUrl: './scenario-form.component.scss',
})
export class ScenarioFormComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private scenarioService = inject(ScenarioService);
  private aiAssist = inject(AiAssistService);

  scenarioType = signal<ScenarioType>('adventure');
  aiDescription = signal('');
  generatingScenario = signal(false);

  form: FormGroup = this.fb.group({
    scenarioType: ['adventure'],
    title: ['', Validators.required],
    setting: ['', Validators.required],
    tone: ['', Validators.required],
    characterName: ['', Validators.required],
    characterDescription: ['', Validators.required],
    npcs: this.fb.array([]),
    rules: this.fb.array([]),
    partnerName: [''],
    partnerDescription: [''],
    relationship: [''],
  });

  constructor() {
    const existing = this.scenarioService.activeScenario();
    if (existing) {
      this.form.patchValue(existing);
      this.scenarioType.set(existing.scenarioType ?? 'adventure');
      this.applyTypeValidators(existing.scenarioType ?? 'adventure');
      existing.npcs.forEach((n) => this.addNpc(n.name, n.description));
      existing.rules.forEach((r) => this.addRule(r));
    }
  }

  setType(type: ScenarioType): void {
    if (type === this.scenarioType()) return;
    this.scenarioType.set(type);
    this.form.patchValue({ scenarioType: type });

    // Clear type-specific fields on switch
    if (type === 'interpersonal') {
      this.npcs.clear();
    } else {
      this.form.patchValue({ partnerName: '', partnerDescription: '', relationship: '' });
    }

    this.applyTypeValidators(type);
  }

  private applyTypeValidators(type: ScenarioType): void {
    if (type === 'interpersonal') {
      this.form.get('partnerName')!.setValidators(Validators.required);
      this.form.get('partnerDescription')!.setValidators(Validators.required);
    } else {
      this.form.get('partnerName')!.clearValidators();
      this.form.get('partnerDescription')!.clearValidators();
    }
    this.form.get('partnerName')!.updateValueAndValidity();
    this.form.get('partnerDescription')!.updateValueAndValidity();
  }

  get npcs(): FormArray {
    return this.form.get('npcs') as FormArray;
  }

  get rules(): FormArray {
    return this.form.get('rules') as FormArray;
  }

  addNpc(name = '', description = ''): void {
    this.npcs.push(this.fb.group({ name: [name, Validators.required], description: [description, Validators.required] }));
  }

  removeNpc(i: number): void {
    this.npcs.removeAt(i);
  }

  addRule(value = ''): void {
    this.rules.push(this.fb.control(value, Validators.required));
  }

  removeRule(i: number): void {
    this.rules.removeAt(i);
  }

  resetForm(): void {
    this.form.reset({
      scenarioType: 'adventure', title: '', setting: '', tone: '',
      characterName: '', characterDescription: '',
      partnerName: '', partnerDescription: '', relationship: '',
    });
    this.npcs.clear();
    this.rules.clear();
    this.scenarioType.set('adventure');
    this.applyTypeValidators('adventure');
  }

  start(): void {
    if (this.form.invalid) return;
    const scenario: Scenario = this.form.value;
    this.scenarioService.setScenario(scenario);
    this.router.navigate(['/chat']);
  }

  async generateWithAi(): Promise<void> {
    const desc = this.aiDescription().trim();
    if (!desc || this.generatingScenario()) return;
    this.generatingScenario.set(true);
    try {
      const scenario = await this.aiAssist.generateScenario(desc, this.scenarioType());
      // Patch the form with generated values
      this.form.patchValue({
        scenarioType: scenario.scenarioType,
        title: scenario.title,
        setting: scenario.setting,
        tone: scenario.tone,
        characterName: scenario.characterName,
        characterDescription: scenario.characterDescription,
        partnerName: scenario.partnerName ?? '',
        partnerDescription: scenario.partnerDescription ?? '',
        relationship: scenario.relationship ?? '',
      });
      // Update type signal + validators
      this.scenarioType.set(scenario.scenarioType);
      this.applyTypeValidators(scenario.scenarioType);
      // Populate NPCs
      this.npcs.clear();
      (scenario.npcs ?? []).forEach((n) => this.addNpc(n.name, n.description));
      // Populate rules
      this.rules.clear();
      (scenario.rules ?? []).forEach((r) => this.addRule(r));
    } catch (err) {
      console.error('AI scenario generation error', err);
    } finally {
      this.generatingScenario.set(false);
    }
  }
}
