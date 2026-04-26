import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { AiAssistService } from '../shared/ai-assist.service';
import { DmNpc, DmNpcAction, DmNpcClass, Quest, QuestEncounter, QuestMonster, QuestReward } from './dm.model';

const STORAGE_KEY_QUESTS = 'dm_saved_quests';
const STORAGE_KEY_NPCS = 'dm_saved_npcs';

@Component({
  selector: 'llama-dm',
  standalone: true,
  imports: [FormsModule, NgClass, DecimalPipe],
  templateUrl: './dm.component.html',
  styleUrl: './dm.component.scss',
})
export class DmComponent {
  private router = inject(Router);
  private aiAssist = inject(AiAssistService);

  // --- Tab ---
  activeTab = signal<'quests' | 'npcs'>('quests');

  // --- Quest creator state ---
  questPrompt = signal('');
  questAdvancedOpen = signal(false);
  questSetting = signal('');
  questTone = signal('');
  questPartyLevel = signal<number | null>(null);
  generatingQuest = signal(false);
  questError = signal<string | null>(null);
  currentQuest = signal<Quest | null>(null);
  savedQuestsOpen = signal(false);
  savedQuests = signal<Quest[]>(this.loadQuests());

  // --- NPC creator state ---
  npcName = signal('');
  npcDescription = signal('');
  npcAdvancedOpen = signal(false);
  npcSetting = signal('');
  npcTone = signal('');
  generatingNpc = signal(false);
  npcError = signal<string | null>(null);
  currentNpc = signal<DmNpc | null>(null);
  savedNpcsOpen = signal(false);
  savedNpcs = signal<DmNpc[]>(this.loadNpcs());

  goBack(): void { this.router.navigate(['/']); }
  setTab(tab: 'quests' | 'npcs'): void { this.activeTab.set(tab); }

  // -----------------------------------------------------------------------
  // Quest actions
  // -----------------------------------------------------------------------

  async generateQuest(): Promise<void> {
    this.questError.set(null);
    const prompt = this.questPrompt().trim();
    if (!prompt || this.generatingQuest()) return;
    this.generatingQuest.set(true);
    try {
      const quest = await this.aiAssist.generateQuest(
        prompt,
        this.questSetting() || undefined,
        this.questTone() || undefined,
        this.questPartyLevel(),
      );
      this.currentQuest.set(quest);
    } catch (err) {
      console.error('Quest generation error', err);
      this.questError.set('Failed to generate quest — is the LLM server running?');
    } finally {
      this.generatingQuest.set(false);
    }
  }

  updateQuestField(field: keyof Quest, value: string | string[] | number | null | QuestReward | QuestEncounter[]): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, [field]: value });
  }

  // Objectives
  updateObjective(idx: number, value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    const arr = [...q.objectives];
    arr[idx] = value;
    this.currentQuest.set({ ...q, objectives: arr });
  }
  addObjective(): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, objectives: [...q.objectives, ''] });
  }
  removeObjective(idx: number): void {
    const q = this.currentQuest();
    if (!q) return;
    const arr = [...q.objectives];
    arr.splice(idx, 1);
    this.currentQuest.set({ ...q, objectives: arr });
  }

  // Rewards
  updateRewardGold(value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, rewards: { ...q.rewards, gold: +value || 0 } });
  }
  updateRewardSilver(value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, rewards: { ...q.rewards, silver: +value || 0 } });
  }
  updateRewardItem(idx: number, value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    const items = [...q.rewards.items];
    items[idx] = value;
    this.currentQuest.set({ ...q, rewards: { ...q.rewards, items } });
  }
  addRewardItem(): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, rewards: { ...q.rewards, items: [...q.rewards.items, ''] } });
  }
  removeRewardItem(idx: number): void {
    const q = this.currentQuest();
    if (!q) return;
    const items = [...q.rewards.items];
    items.splice(idx, 1);
    this.currentQuest.set({ ...q, rewards: { ...q.rewards, items } });
  }

  // Encounters
  addEncounter(): void {
    const q = this.currentQuest();
    if (!q) return;
    const enc: QuestEncounter = { description: '', monsters: [] };
    this.currentQuest.set({ ...q, encounters: [...q.encounters, enc] });
  }
  removeEncounter(idx: number): void {
    const q = this.currentQuest();
    if (!q) return;
    const encs = [...q.encounters];
    encs.splice(idx, 1);
    this.currentQuest.set({ ...q, encounters: encs });
  }
  updateEncounterDesc(encIdx: number, value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    const encs = q.encounters.map((e, i) => i === encIdx ? { ...e, description: value } : e);
    this.currentQuest.set({ ...q, encounters: encs });
  }

  // Monsters
  addMonster(encIdx: number): void {
    const q = this.currentQuest();
    if (!q) return;
    const monster: QuestMonster = { name: '', cr: '' };
    const encs = q.encounters.map((e, i) =>
      i === encIdx ? { ...e, monsters: [...e.monsters, monster] } : e
    );
    this.currentQuest.set({ ...q, encounters: encs });
  }
  removeMonster(encIdx: number, monIdx: number): void {
    const q = this.currentQuest();
    if (!q) return;
    const encs = q.encounters.map((e, i) => {
      if (i !== encIdx) return e;
      const monsters = [...e.monsters];
      monsters.splice(monIdx, 1);
      return { ...e, monsters };
    });
    this.currentQuest.set({ ...q, encounters: encs });
  }
  updateMonsterName(encIdx: number, monIdx: number, value: string): void {
    this._updateMonster(encIdx, monIdx, { name: value });
  }
  updateMonsterCr(encIdx: number, monIdx: number, value: string): void {
    this._updateMonster(encIdx, monIdx, { cr: value });
  }
  private _updateMonster(encIdx: number, monIdx: number, patch: Partial<QuestMonster>): void {
    const q = this.currentQuest();
    if (!q) return;
    const encs = q.encounters.map((e, i) => {
      if (i !== encIdx) return e;
      const monsters = e.monsters.map((m, j) => j === monIdx ? { ...m, ...patch } : m);
      return { ...e, monsters };
    });
    this.currentQuest.set({ ...q, encounters: encs });
  }

  saveQuest(): void {
    const q = this.currentQuest();
    if (!q) return;
    const updated = [q, ...this.savedQuests().filter(s => s.id !== q.id)];
    this.savedQuests.set(updated);
    this.saveToStorage(STORAGE_KEY_QUESTS, updated);
    this.currentQuest.set(null);
    this.questPrompt.set('');
    this.savedQuestsOpen.set(true);
  }

  deleteQuest(id: string): void {
    const updated = this.savedQuests().filter(q => q.id !== id);
    this.savedQuests.set(updated);
    this.saveToStorage(STORAGE_KEY_QUESTS, updated);
  }

  newQuest(): void {
    this.currentQuest.set(null);
    this.questPrompt.set('');
    this.questPartyLevel.set(null);
    this.questError.set(null);
  }

  // -----------------------------------------------------------------------
  // NPC actions
  // -----------------------------------------------------------------------

  async generateNpc(): Promise<void> {
    this.npcError.set(null);
    if (this.generatingNpc()) return;
    this.generatingNpc.set(true);
    try {
      const raw = await this.aiAssist.generateNpc(
        this.npcName(), this.npcDescription(), this.npcSetting(), this.npcTone(), '',
      );
      const npc: DmNpc = {
        id: crypto.randomUUID(),
        name: raw.name ?? this.npcName() ?? 'Unknown',
        race: raw.race ?? '',
        description: raw.description ?? '',
        personality: raw.personality ?? '',
        alignment: raw.alignment ?? '',
        cr: raw.cr ?? '',
        classes: (raw.classes ?? []).map((c: { name?: string; level?: number }): DmNpcClass => ({
          name: c.name ?? '',
          level: c.level ?? 1,
        })),
        stats: raw.stats ?? {},
        savingThrows: raw.saving_throws ?? [],
        skills: raw.skills ?? [],
        equipment: raw.equipment ?? [],
        actions: (raw.actions ?? []).map((a: { name?: string; description?: string }): DmNpcAction => ({
          name: a.name ?? '',
          description: a.description ?? '',
        })),
        foes: raw.foes ?? [],
        friends: raw.friends ?? [],
        plotTwists: raw.plot_twists ?? [],
      };
      this.currentNpc.set(npc);
    } catch (err) {
      console.error('NPC generation error', err);
      this.npcError.set('Failed to generate NPC — is the LLM server running?');
    } finally {
      this.generatingNpc.set(false);
    }
  }

  updateNpcField(field: keyof DmNpc, value: string | string[] | Record<string, number> | DmNpcClass[] | DmNpcAction[]): void {
    const n = this.currentNpc();
    if (!n) return;
    this.currentNpc.set({ ...n, [field]: value });
  }
  updateNpcStat(stat: string, value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    const num = parseInt(value, 10);
    this.currentNpc.set({ ...n, stats: { ...n.stats, [stat]: isNaN(num) ? undefined : Math.min(20, Math.max(1, num)) } });
  }
  updateNpcListItem(field: 'foes' | 'friends' | 'plotTwists' | 'savingThrows' | 'skills' | 'equipment', idx: number, value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = [...(n[field] as string[])];
    arr[idx] = value;
    this.currentNpc.set({ ...n, [field]: arr });
  }
  addNpcListItem(field: 'foes' | 'friends' | 'plotTwists' | 'savingThrows' | 'skills' | 'equipment'): void {
    const n = this.currentNpc();
    if (!n) return;
    this.currentNpc.set({ ...n, [field]: [...(n[field] as string[]), ''] });
  }
  removeNpcListItem(field: 'foes' | 'friends' | 'plotTwists' | 'savingThrows' | 'skills' | 'equipment', idx: number): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = [...(n[field] as string[])];
    arr.splice(idx, 1);
    this.currentNpc.set({ ...n, [field]: arr });
  }

  // Classes
  addNpcClass(): void {
    const n = this.currentNpc();
    if (!n) return;
    this.currentNpc.set({ ...n, classes: [...n.classes, { name: '', level: 1 }] });
  }
  removeNpcClass(idx: number): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = [...n.classes];
    arr.splice(idx, 1);
    this.currentNpc.set({ ...n, classes: arr });
  }
  updateNpcClassName(idx: number, value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = n.classes.map((c, i) => i === idx ? { ...c, name: value } : c);
    this.currentNpc.set({ ...n, classes: arr });
  }
  updateNpcClassLevel(idx: number, value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = n.classes.map((c, i) => i === idx ? { ...c, level: Math.min(20, Math.max(1, +value || 1)) } : c);
    this.currentNpc.set({ ...n, classes: arr });
  }

  // Actions
  addNpcAction(): void {
    const n = this.currentNpc();
    if (!n) return;
    this.currentNpc.set({ ...n, actions: [...n.actions, { name: '', description: '' }] });
  }
  removeNpcAction(idx: number): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = [...n.actions];
    arr.splice(idx, 1);
    this.currentNpc.set({ ...n, actions: arr });
  }
  updateNpcActionName(idx: number, value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = n.actions.map((a, i) => i === idx ? { ...a, name: value } : a);
    this.currentNpc.set({ ...n, actions: arr });
  }
  updateNpcActionDesc(idx: number, value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    const arr = n.actions.map((a, i) => i === idx ? { ...a, description: value } : a);
    this.currentNpc.set({ ...n, actions: arr });
  }

  saveNpc(): void {
    const n = this.currentNpc();
    if (!n) return;
    const updated = [n, ...this.savedNpcs().filter(s => s.id !== n.id)];
    this.savedNpcs.set(updated);
    this.saveToStorage(STORAGE_KEY_NPCS, updated);
    this.currentNpc.set(null);
    this.npcName.set('');
    this.npcDescription.set('');
    this.savedNpcsOpen.set(true);
  }
  deleteNpc(id: string): void {
    const updated = this.savedNpcs().filter(n => n.id !== id);
    this.savedNpcs.set(updated);
    this.saveToStorage(STORAGE_KEY_NPCS, updated);
  }
  newNpc(): void {
    this.currentNpc.set(null);
    this.npcName.set('');
    this.npcDescription.set('');
    this.npcError.set(null);
  }

  difficultyClass(difficulty: string): string {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'diff-easy';
      case 'medium': return 'diff-medium';
      case 'hard': return 'diff-hard';
      case 'deadly': return 'diff-deadly';
      default: return 'diff-medium';
    }
  }

  statKeys(): string[] { return ['str', 'dex', 'con', 'int', 'wis', 'cha']; }
  statLabel(key: string): string {
    const map: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
    return map[key] ?? key.toUpperCase();
  }

  private saveToStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota / private browsing */ }
  }

  private loadQuests(): Quest[] {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY_QUESTS) ?? '[]');
      return raw.map(q => ({
        ...q,
        // Migrate legacy flat rewards string[] → QuestReward
        rewards: Array.isArray(q.rewards)
          ? { gold: 0, silver: 0, items: q.rewards as string[] }
          : (q.rewards ?? { gold: 0, silver: 0, items: [] }),
        // Migrate legacy flat encounters string[] → QuestEncounter[]
        encounters: Array.isArray(q.encounters) && q.encounters.length > 0 && typeof q.encounters[0] === 'string'
          ? (q.encounters as string[]).map((e: string) => ({ description: e, monsters: [] }))
          : (Array.isArray(q.encounters) ? q.encounters : []),
        xpBudget: q.xpBudget ?? null,
      }));
    } catch { return []; }
  }

  private loadNpcs(): DmNpc[] {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY_NPCS) ?? '[]');
      return raw.map(n => ({
        ...n,
        race: n.race ?? '',
        alignment: n.alignment ?? '',
        cr: n.cr ?? '',
        classes: n.classes ?? [],
        savingThrows: n.savingThrows ?? [],
        skills: n.skills ?? [],
        equipment: n.equipment ?? [],
        actions: n.actions ?? [],
        foes: n.foes ?? [],
        friends: n.friends ?? [],
        plotTwists: n.plotTwists ?? [],
      }));
    } catch { return []; }
  }
}
