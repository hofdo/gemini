import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { StorySessionService } from '../../core/story-session.service';
import { DmToolsService, type QuestDto } from '../../core/dm-tools.service';
import type { NpcDto } from '@nx-monorepo-experiment/shared-api-contracts';

type TrackedNpc = NpcDto & { _id: string };

@Component({
  selector: 'story-dm',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './dm.component.html',
  styleUrl: './dm.component.scss',
})
export class DmComponent {
  private readonly route = inject(ActivatedRoute);
  readonly story = inject(StorySessionService);
  private readonly dmTools = inject(DmToolsService);

  readonly activeTab = signal<'quests' | 'npcs'>('quests');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Quest tab state
  readonly questPrompt = signal('');
  readonly questPartyLevel = signal(1);
  readonly questSetting = signal('');
  readonly questTone = signal('');
  readonly currentQuest = signal<QuestDto | null>(null);
  readonly savedQuests = signal<QuestDto[]>([]);

  // NPC tab state
  readonly npcName = signal('');
  readonly npcDescription = signal('');
  readonly npcSetting = signal('');
  readonly npcTone = signal('');
  readonly currentNpc = signal<TrackedNpc | null>(null);
  readonly savedNpcs = signal<TrackedNpc[]>([]);

  readonly workspaceId = this.route.snapshot.paramMap.get('id') ?? '';

  setTab(tab: 'quests' | 'npcs'): void {
    this.activeTab.set(tab);
  }

  // ----- Quest actions -----

  async generateQuest(): Promise<void> {
    const prompt = this.questPrompt().trim();
    if (!prompt || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const quest = await this.dmTools.generateQuest(
        prompt,
        this.questPartyLevel(),
        this.questSetting() || undefined,
        this.questTone() || undefined,
      );
      this.currentQuest.set(quest);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Quest generation failed.');
    } finally {
      this.loading.set(false);
    }
  }

  updateQuestTitle(value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, title: value });
  }

  updateQuestDescription(value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, description: value });
  }

  updateQuestObjective(index: number, value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    const objectives = [...q.objectives];
    objectives[index] = value;
    this.currentQuest.set({ ...q, objectives });
  }

  addQuestObjective(): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, objectives: [...q.objectives, ''] });
  }

  removeQuestObjective(index: number): void {
    const q = this.currentQuest();
    if (!q) return;
    const objectives = [...q.objectives];
    objectives.splice(index, 1);
    this.currentQuest.set({ ...q, objectives });
  }

  updateQuestReward(value: string): void {
    const q = this.currentQuest();
    if (!q) return;
    this.currentQuest.set({ ...q, reward: value });
  }

  saveQuestToCollection(): void {
    const q = this.currentQuest();
    if (!q) return;
    this.savedQuests.set([q, ...this.savedQuests().filter((s) => s.id !== q.id)]);
    this.currentQuest.set(null);
    this.questPrompt.set('');
  }

  async promoteQuestToLog(quest: QuestDto): Promise<void> {
    if (!this.story.activeSession()) {
      this.error.set('No active session. Load a session first.');
      return;
    }
    await this.story.addQuestToSession({ id: quest.id, title: quest.title, status: 'active' });
  }

  newQuest(): void {
    this.currentQuest.set(null);
    this.questPrompt.set('');
    this.error.set(null);
  }

  // ----- NPC actions -----

  async generateNpc(): Promise<void> {
    const name = this.npcName().trim();
    const desc = this.npcDescription().trim();
    if (!name || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const npc = await this.dmTools.generateNpc(
        name,
        desc,
        this.npcSetting() || undefined,
        this.npcTone() || undefined,
      );
      this.currentNpc.set({ ...npc, _id: crypto.randomUUID() });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'NPC generation failed.');
    } finally {
      this.loading.set(false);
    }
  }

  updateNpcName(value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    this.currentNpc.set({ ...n, name: value });
  }

  updateNpcDescription(value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    this.currentNpc.set({ ...n, description: value });
  }

  updateNpcPersonality(value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    this.currentNpc.set({ ...n, personality: value });
  }

  updateNpcStat(stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', value: string): void {
    const n = this.currentNpc();
    if (!n) return;
    const num = Number(value);
    const stats = { ...(n.stats ?? {}) };
    if (Number.isFinite(num)) {
      stats[stat] = num;
    } else {
      delete stats[stat];
    }
    this.currentNpc.set({ ...n, stats });
  }

  readNpcStat(stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'): number | null {
    return this.currentNpc()?.stats?.[stat] ?? null;
  }

  saveNpcToCollection(): void {
    const n = this.currentNpc();
    if (!n) return;
    this.savedNpcs.set([n, ...this.savedNpcs().filter((s) => s._id !== n._id)]);
    this.currentNpc.set(null);
    this.npcName.set('');
    this.npcDescription.set('');
  }

  async promoteNpcToWorld(npc: TrackedNpc): Promise<void> {
    if (!this.story.activeSession()) {
      this.error.set('No active session. Load a session first.');
      return;
    }
    const npcId = npc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await this.story.addNpcToSession({ npcId, name: npc.name, status: 'alive', disposition: 0 });
  }

  newNpc(): void {
    this.currentNpc.set(null);
    this.npcName.set('');
    this.npcDescription.set('');
    this.error.set(null);
  }

  statKeys(): Array<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'> {
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  }
}
