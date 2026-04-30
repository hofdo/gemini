import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Npc, Scenario, NpcMode, ScenarioService } from '@nx-monorepo-experiment/shared-scenario';
import { APP_CONFIG } from '@nx-monorepo-experiment/shared-config';

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

interface GeneratedFaction {
  id: string;
  name: string;
  description: string;
  goal: string;
  archetype: string;
  territories: string[];
}

interface GeneratedNpc {
  name: string;
  description: string;
  personality: string;
}

interface GeneratedScene {
  scene_title: string;
  description: string;
  opening_line: string;
  tension: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'llama-session-zero',
  standalone: true,
  imports: [FormsModule, UpperCasePipe],
  templateUrl: './session-zero.component.html',
  styleUrl: './session-zero.component.scss',
})
export class SessionZeroComponent {
  private router = inject(Router);
  private scenarioService = inject(ScenarioService);

  step = signal<1 | 2 | 3 | 4 | 5>(1);
  loading = signal(false);
  error = signal<string | null>(null);

  // Step 1
  premiseText = signal('');
  scenario = signal<Scenario | null>(null);

  // Editable scenario fields (bound with ngModel)
  scenarioTitle = signal('');
  scenarioSetting = signal('');
  scenarioTone = signal('');
  scenarioCharacterName = signal('');
  scenarioCharacterDescription = signal('');

  // Step 2
  factions = signal<GeneratedFaction[]>([]);

  // Step 3
  npcsByFaction = signal<Record<string, GeneratedNpc[]>>({});
  generatingNpcFor = signal<string | null>(null);

  // Step 4
  openingScene = signal<GeneratedScene | null>(null);
  openingSceneTitle = signal('');
  openingSceneDescription = signal('');
  openingSceneLine = signal('');

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  nextStep(): void {
    this.step.update(s => (s + 1) as 1 | 2 | 3 | 4 | 5);
  }

  prevStep(): void {
    this.step.update(s => (s - 1) as 1 | 2 | 3 | 4 | 5);
    this.error.set(null);
  }

  goBack(): void {
    this.router.navigate(['/dm']);
  }

  // ---------------------------------------------------------------------------
  // Step 1 — Generate Premise
  // ---------------------------------------------------------------------------

  async generatePremise(): Promise<void> {
    const text = this.premiseText().trim();
    if (!text || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      const response = await fetch('/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
        body: JSON.stringify({ description: text, scenario_type: 'adventure' }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const s: Scenario = {
        scenarioType: data.scenario_type ?? 'adventure',
        title: data.title ?? '',
        setting: data.setting ?? '',
        tone: data.tone ?? '',
        characterName: data.character_name ?? '',
        characterDescription: data.character_description ?? '',
        npcs: [],
        rules: data.rules ?? [],
      };
      this.scenario.set(s);
      this.scenarioTitle.set(s.title);
      this.scenarioSetting.set(s.setting);
      this.scenarioTone.set(s.tone);
      this.scenarioCharacterName.set(s.characterName);
      this.scenarioCharacterDescription.set(s.characterDescription);
    } catch (err) {
      console.error('Premise generation error', err);
      this.error.set('Failed to generate premise — is the LLM server running?');
    } finally {
      this.loading.set(false);
    }
  }

  syncScenarioFromFields(): void {
    const s = this.scenario();
    if (!s) return;
    this.scenario.set({
      ...s,
      title: this.scenarioTitle(),
      setting: this.scenarioSetting(),
      tone: this.scenarioTone(),
      characterName: this.scenarioCharacterName(),
      characterDescription: this.scenarioCharacterDescription(),
    });
  }

  // ---------------------------------------------------------------------------
  // Step 2 — Generate Factions
  // ---------------------------------------------------------------------------

  async generateFactions(): Promise<void> {
    const s = this.scenario();
    if (!s || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      const response = await fetch('/generate-faction-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
        body: JSON.stringify({
          scenario_title: s.title,
          setting: s.setting,
          tone: s.tone,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const factions: GeneratedFaction[] = (Array.isArray(data) ? data : []).map(
        (f: {
          id?: string; name?: string; description?: string; goal?: string;
          archetype?: string; territories?: string[];
        }) => ({
          id: f.id ?? crypto.randomUUID(),
          name: f.name ?? '',
          description: f.description ?? '',
          goal: f.goal ?? '',
          archetype: f.archetype ?? '',
          territories: f.territories ?? [],
        }),
      );
      this.factions.set(factions);
    } catch (err) {
      console.error('Faction generation error', err);
      this.error.set('Failed to generate factions — is the LLM server running?');
    } finally {
      this.loading.set(false);
    }
  }

  updateFactionField(id: string, field: 'name' | 'goal' | 'description', value: string): void {
    this.factions.update(list =>
      list.map(f => f.id === id ? { ...f, [field]: value } : f),
    );
  }

  // ---------------------------------------------------------------------------
  // Step 3 — Generate NPCs
  // ---------------------------------------------------------------------------

  npcCountForFaction(factionId: string): number {
    return (this.npcsByFaction()[factionId] ?? []).length;
  }

  async generateNpcForFaction(factionId: string, factionName: string): Promise<void> {
    if (this.npcCountForFaction(factionId) >= 2 || this.generatingNpcFor()) return;
    const s = this.scenario();
    this.error.set(null);
    this.generatingNpcFor.set(factionId);
    try {
      const response = await fetch('/generate-npc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
        body: JSON.stringify({
          npc_name: '',
          npc_description: `Member of ${factionName}`,
          setting: s?.setting ?? '',
          tone: s?.tone ?? '',
          title: factionName,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const npc: GeneratedNpc = {
        name: data.name ?? 'Unknown',
        description: data.description ?? '',
        personality: data.personality ?? '',
      };
      this.npcsByFaction.update(map => ({
        ...map,
        [factionId]: [...(map[factionId] ?? []), npc],
      }));
    } catch (err) {
      console.error('NPC generation error', err);
      this.error.set('Failed to generate NPC — is the LLM server running?');
    } finally {
      this.generatingNpcFor.set(null);
    }
  }

  factionsForStep3(): GeneratedFaction[] {
    return this.factions();
  }

  npcsForFaction(factionId: string): GeneratedNpc[] {
    return this.npcsByFaction()[factionId] ?? [];
  }

  npcNamesForFaction(factionId: string): string {
    return this.npcsForFaction(factionId).map(n => n.name).join(', ');
  }

  totalNpcCount(): number {
    return Object.values(this.npcsByFaction()).reduce((sum, arr) => sum + arr.length, 0);
  }

  // ---------------------------------------------------------------------------
  // Step 4 — Generate Opening Scene
  // ---------------------------------------------------------------------------

  async generateOpeningScene(): Promise<void> {
    const s = this.scenario();
    if (!s || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      const allNpcNames = Object.values(this.npcsByFaction())
        .flat()
        .map(n => n.name);
      const response = await fetch('/generate-opening-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(APP_CONFIG.timeoutMs),
        body: JSON.stringify({
          scenario_title: s.title,
          setting: s.setting,
          tone: s.tone,
          character_name: s.characterName,
          character_description: s.characterDescription,
          factions: this.factions(),
          npc_names: allNpcNames,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const scene: GeneratedScene = {
        scene_title: data.scene_title ?? '',
        description: data.description ?? '',
        opening_line: data.opening_line ?? '',
        tension: data.tension ?? 'calm',
      };
      this.openingScene.set(scene);
      this.openingSceneTitle.set(scene.scene_title);
      this.openingSceneDescription.set(scene.description);
      this.openingSceneLine.set(scene.opening_line);
    } catch (err) {
      console.error('Opening scene generation error', err);
      this.error.set('Failed to generate opening scene — is the LLM server running?');
    } finally {
      this.loading.set(false);
    }
  }

  syncOpeningSceneFromFields(): void {
    const os = this.openingScene();
    if (!os) return;
    this.openingScene.set({
      ...os,
      scene_title: this.openingSceneTitle(),
      description: this.openingSceneDescription(),
      opening_line: this.openingSceneLine(),
    });
  }

  // ---------------------------------------------------------------------------
  // Step 5 — Export
  // ---------------------------------------------------------------------------

  downloadJson(): void {
    const data = {
      scenario: this.scenario(),
      factions: this.factions(),
      npcsByFaction: this.npcsByFaction(),
      openingScene: this.openingScene(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-zero-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  stepLabel(n: number): string {
    const labels: Record<number, string> = {
      1: 'Premise',
      2: 'Factions',
      3: 'NPCs',
      4: 'Scene',
      5: 'Export',
    };
    return labels[n] ?? '';
  }

  startAdventure(): void {
    const s = this.scenario();
    if (!s) return;
    const allNpcs: Npc[] = Object.values(this.npcsByFaction())
      .flat()
      .map(n => ({
        name: n.name,
        description: n.description,
        mode: 'simple' as NpcMode,
        personality: n.personality,
      }));
    this.scenarioService.setScenario({ ...s, npcs: [...(s.npcs ?? []), ...allNpcs] });
    this.router.navigate(['/chat']);
  }
}
