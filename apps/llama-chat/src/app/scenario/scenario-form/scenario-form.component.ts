import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ScenarioService } from '../scenario.service';
import { AiAssistService } from '../../shared/ai-assist.service';
import { Scenario, ScenarioType, NpcMode } from '../scenario.model';
import { PresetScenarioService, PresetMeta } from '../preset-scenario.service';

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
  private route = inject(ActivatedRoute);
  private scenarioService = inject(ScenarioService);
  private aiAssist = inject(AiAssistService);
  private presetService = inject(PresetScenarioService);

  scenarioType = signal<ScenarioType>('adventure');
  aiDescription = signal('');
  generatingScenario = signal(false);
  generatingNpc = signal<number | null>(null);
  npcGenerationError = signal<string | null>(null);
  scenarioGenerationError = signal<string | null>(null);
  presets = signal<PresetMeta[]>([]);
  loadingPreset = signal(false);

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
    partnerGender: [''],
    partnerPersonality: [''],
    partnerBodyDescription: [''],
    partnerAppearance: [''],
    partnerRelationship: [''],
    partnerLikes: [''],
    partnerDislikes: [''],
    partnerTurnOns: [''],
  });

  constructor() {
    // Read mode from route param
    const rawMode = this.route.snapshot.paramMap.get('mode');
    if (rawMode !== 'adventure' && rawMode !== 'interpersonal') {
      this.router.navigate(['/']);
      return;
    }
    const mode = rawMode as ScenarioType;
    this.scenarioType.set(mode);
    this.form.get('scenarioType')?.setValue(mode);
    this.applyTypeValidators(mode);

    const existing = this.scenarioService.activeScenario();
    if (existing && existing.scenarioType === this.scenarioType()) {
      this.form.patchValue(existing);
      existing.npcs.forEach((n) =>
        this.addNpc(n.name, n.description, n.mode ?? 'simple', n.stats, n.personality, n.foes, n.friends, n.plotTwists)
      );
      existing.rules.forEach((r) => this.addRule(r));
    }

    this.presetService.loadIndex()
      .then(all => this.presets.set(all.filter(p => p.type === this.scenarioType())))
      .catch(() => undefined);
  }

  async loadPreset(id: string): Promise<void> {
    const meta = this.presets().find(p => p.id === id);
    if (!meta || this.loadingPreset()) return;
    this.loadingPreset.set(true);
    try {
      const scenario = await this.presetService.loadScenario(meta);
      this.form.patchValue({
        scenarioType: scenario.scenarioType,
        title: scenario.title,
        setting: scenario.setting,
        tone: scenario.tone,
        characterName: scenario.characterName,
        characterDescription: scenario.characterDescription,
      });
      this.npcs.clear();
      (scenario.npcs ?? []).forEach((n) =>
        this.addNpc(n.name, n.description, n.mode ?? 'simple', n.stats, n.personality, n.foes, n.friends, n.plotTwists)
      );
      this.rules.clear();
      (scenario.rules ?? []).forEach((r) => this.addRule(r));
    } catch (err) {
      console.error('Failed to load preset', err);
    } finally {
      this.loadingPreset.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  private applyTypeValidators(type: ScenarioType): void {
    if (type === 'interpersonal') {
      this.form.get('partnerName')?.setValidators(Validators.required);
    } else {
      this.form.get('partnerName')?.clearValidators();
    }
    this.form.get('partnerName')?.updateValueAndValidity();
  }

  get npcs(): FormArray {
    return this.form.get('npcs') as FormArray;
  }

  get rules(): FormArray {
    return this.form.get('rules') as FormArray;
  }

  // --- NPC helpers ---

  addNpc(
    name = '', description = '', mode: NpcMode = 'simple',
    stats?: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number },
    personality = '', foes: string[] = [], friends: string[] = [], plotTwists: string[] = [],
  ): void {
    const foesArray = this.fb.array(foes.map(f => this.fb.control(f, Validators.required)));
    const friendsArray = this.fb.array(friends.map(f => this.fb.control(f, Validators.required)));
    const plotTwistsArray = this.fb.array(plotTwists.map(p => this.fb.control(p, Validators.required)));

    this.npcs.push(this.fb.group({
      name: [name, Validators.required],
      description: [description, Validators.required],
      mode: [mode],
      stats: this.fb.group({
        str: [stats?.str ?? null],
        dex: [stats?.dex ?? null],
        con: [stats?.con ?? null],
        int: [stats?.int ?? null],
        wis: [stats?.wis ?? null],
        cha: [stats?.cha ?? null],
      }),
      personality: [personality ?? ''],
      foes: foesArray,
      friends: friendsArray,
      plotTwists: plotTwistsArray,
    }));
  }

  removeNpc(i: number): void {
    this.npcs.removeAt(i);
  }

  async generateNpcWithAi(i: number): Promise<void> {
    if (this.generatingNpc() !== null || this.generatingScenario()) return;
    this.generatingNpc.set(i);
    this.npcGenerationError.set(null);

    try {
      const npcGroup = this.npcs.at(i) as FormGroup;
      const name = npcGroup.get('name')?.value ?? '';
      const description = npcGroup.get('description')?.value ?? '';
      const setting = this.form.get('setting')?.value ?? '';
      const tone = this.form.get('tone')?.value ?? '';
      const title = this.form.get('title')?.value ?? '';

      const result = await this.aiAssist.generateNpc(name, description, setting, tone, title);

      // Update name/description only if they were empty
      if (result.name && !name) npcGroup.get('name')?.setValue(result.name);
      if (result.description && !description) npcGroup.get('description')?.setValue(result.description);

      // Switch to detailed mode and fill all detail fields
      npcGroup.get('mode')?.setValue('detailed');
      npcGroup.get('personality')?.setValue(result.personality ?? '');

      // Update stats
      const statsGroup = npcGroup.get('stats') as FormGroup;
      if (result.stats) {
        statsGroup.get('str')?.setValue(result.stats['str'] ?? null);
        statsGroup.get('dex')?.setValue(result.stats['dex'] ?? null);
        statsGroup.get('con')?.setValue(result.stats['con'] ?? null);
        statsGroup.get('int')?.setValue(result.stats['int'] ?? null);
        statsGroup.get('wis')?.setValue(result.stats['wis'] ?? null);
        statsGroup.get('cha')?.setValue(result.stats['cha'] ?? null);
      }

      // Replace foes
      const foesArray = npcGroup.get('foes') as FormArray;
      foesArray.clear();
      (result.foes ?? []).forEach((f: string) => foesArray.push(this.fb.control(f, Validators.required)));

      // Replace friends
      const friendsArray = npcGroup.get('friends') as FormArray;
      friendsArray.clear();
      (result.friends ?? []).forEach((f: string) => friendsArray.push(this.fb.control(f, Validators.required)));

      // Replace plot twists
      const plotTwistsArray = npcGroup.get('plotTwists') as FormArray;
      plotTwistsArray.clear();
      (result.plot_twists ?? []).forEach((p: string) => plotTwistsArray.push(this.fb.control(p, Validators.required)));
    } catch (err) {
      console.error('AI NPC generation error', err);
      this.npcGenerationError.set('Failed to generate NPC — is the LLM server running?');
    } finally {
      this.generatingNpc.set(null);
    }
  }

  toggleNpcMode(i: number): void {
    const npcGroup = this.npcs.at(i) as FormGroup;
    const current = (npcGroup.get('mode')?.value as NpcMode) ?? 'simple';
    npcGroup.get('mode')?.setValue(current === 'simple' ? 'detailed' : 'simple');
  }

  getNpcMode(i: number): NpcMode {
    return ((this.npcs.at(i) as FormGroup).get('mode')?.value as NpcMode) ?? 'simple';
  }

  getNpcFoes(i: number): FormArray {
    return (this.npcs.at(i) as FormGroup).get('foes') as FormArray;
  }

  getNpcFriends(i: number): FormArray {
    return (this.npcs.at(i) as FormGroup).get('friends') as FormArray;
  }

  getNpcPlotTwists(i: number): FormArray {
    return (this.npcs.at(i) as FormGroup).get('plotTwists') as FormArray;
  }

  addNpcFoe(i: number, value = ''): void {
    this.getNpcFoes(i).push(this.fb.control(value, Validators.required));
  }

  removeNpcFoe(npcIndex: number, foeIndex: number): void {
    this.getNpcFoes(npcIndex).removeAt(foeIndex);
  }

  addNpcFriend(i: number, value = ''): void {
    this.getNpcFriends(i).push(this.fb.control(value, Validators.required));
  }

  removeNpcFriend(npcIndex: number, friendIndex: number): void {
    this.getNpcFriends(npcIndex).removeAt(friendIndex);
  }

  addNpcPlotTwist(i: number, value = ''): void {
    this.getNpcPlotTwists(i).push(this.fb.control(value, Validators.required));
  }

  removeNpcPlotTwist(npcIndex: number, twistIndex: number): void {
    this.getNpcPlotTwists(npcIndex).removeAt(twistIndex);
  }

  // --- Rule helpers ---

  addRule(value = ''): void {
    this.rules.push(this.fb.control(value, Validators.required));
  }

  removeRule(i: number): void {
    this.rules.removeAt(i);
  }

  resetForm(): void {
    const type = this.scenarioType();
    this.form.reset({
      scenarioType: type, title: '', setting: '', tone: '',
      characterName: '', characterDescription: '',
      partnerName: '', partnerGender: '', partnerPersonality: '',
      partnerBodyDescription: '', partnerAppearance: '', partnerRelationship: '',
      partnerLikes: '', partnerDislikes: '', partnerTurnOns: '',
    });
    this.npcs.clear();
    this.rules.clear();
    this.applyTypeValidators(type);
  }

  start(): void {
    if (this.form.invalid) return;
    const scenario: Scenario = this.form.value;
    this.scenarioService.setScenario(scenario);
    this.router.navigate(['/chat']);
  }

  async generateWithAi(): Promise<void> {
    this.scenarioGenerationError.set(null);
    const desc = this.aiDescription().trim();
    if (!desc || this.generatingScenario()) return;
    this.generatingScenario.set(true);
    try {
      const scenario = await this.aiAssist.generateScenario(desc, this.scenarioType());
      this.form.patchValue({
        scenarioType: scenario.scenarioType,
        title: scenario.title,
        setting: scenario.setting,
        tone: scenario.tone,
        characterName: scenario.characterName,
        characterDescription: scenario.characterDescription,
        partnerName: scenario.partnerName ?? '',
        partnerGender: scenario.partnerGender ?? '',
        partnerPersonality: scenario.partnerPersonality ?? '',
        partnerBodyDescription: scenario.partnerBodyDescription ?? '',
        partnerAppearance: scenario.partnerAppearance ?? '',
        partnerRelationship: scenario.partnerRelationship ?? '',
        partnerLikes: scenario.partnerLikes ?? '',
        partnerDislikes: scenario.partnerDislikes ?? '',
        partnerTurnOns: scenario.partnerTurnOns ?? '',
      });
      this.scenarioType.set(scenario.scenarioType);
      this.applyTypeValidators(scenario.scenarioType);
      // Populate NPCs
      this.npcs.clear();
      (scenario.npcs ?? []).forEach((n) =>
        this.addNpc(n.name, n.description, n.mode ?? 'simple', n.stats, n.personality, n.foes, n.friends, n.plotTwists)
      );
      // Populate rules
      this.rules.clear();
      (scenario.rules ?? []).forEach((r) => this.addRule(r));
    } catch (err) {
      console.error('AI scenario generation error', err);
      this.scenarioGenerationError.set(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      this.generatingScenario.set(false);
    }
  }
}
