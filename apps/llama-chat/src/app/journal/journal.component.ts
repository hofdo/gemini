import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { WorldStateService } from '../world-state/world-state.service';
import { QuestEntry } from '../world-state/quest.model';
import { StoryEvent } from '../world-state/story.model';

@Component({
  selector: 'llama-journal',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './journal.component.html',
})
export class JournalComponent {
  private router = inject(Router);
  private worldStateService = inject(WorldStateService);

  readonly worldState = this.worldStateService.state;
  readonly activeTab = signal<'quests' | 'events' | 'summaries' | 'character'>('quests');

  readonly activeQuests = computed(() => this.worldState()?.questLog.filter(q => q.status === 'active') ?? []);
  readonly completedQuests = computed(() => this.worldState()?.questLog.filter(q => q.status !== 'active') ?? []);
  readonly recentEvents = computed(() => [...(this.worldState()?.storyEvents ?? [])].reverse());
  readonly sessionSummaries = computed(() => [...(this.worldState()?.sessionSummaries ?? [])].reverse());
  readonly playerCharacter = computed(() => this.worldState()?.playerCharacter ?? null);

  setTab(tab: 'quests' | 'events' | 'summaries' | 'character'): void {
    this.activeTab.set(tab);
  }

  toggleObjective(quest: QuestEntry, index: number): void {
    this.worldStateService.updateQuestObjective(quest.id, index, !quest.objectives[index].done);
  }

  certaintyIcon(certainty: StoryEvent['certainty']): string {
    return { witnessed: '👁', rumored: '💬', deduced: '🔍', false: '✗' }[certainty] ?? '?';
  }

  aptitudeKeys(): (keyof NonNullable<ReturnType<typeof this.playerCharacter>>['aptitudes'])[] {
    return ['bold', 'subtle', 'learned', 'connected', 'fierce', 'resilient'];
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
