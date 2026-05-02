import { Component, computed, inject, signal } from '@angular/core';
import { StorySessionService } from '../../core/story-session.service';

type JournalTab = 'quests' | 'events' | 'sessions' | 'character';

@Component({
  selector: 'story-journal',
  standalone: true,
  templateUrl: './journal.component.html',
  styleUrl: './journal.component.scss',
})
export class JournalComponent {
  private readonly sessionService = inject(StorySessionService);

  readonly activeTab = signal<JournalTab>('quests');

  readonly worldState = computed(() => this.sessionService.activeSession()?.worldState ?? null);

  readonly activeQuests = computed(() =>
    (this.worldState()?.questLog ?? []).filter((q) => q.status === 'active'),
  );

  readonly completedQuests = computed(() =>
    (this.worldState()?.questLog ?? []).filter((q) => q.status !== 'active'),
  );

  readonly recentEvents = computed(() =>
    [...(this.worldState()?.events ?? [])].sort((a, b) => b.turn - a.turn),
  );

  readonly keyFacts = computed(() => this.worldState()?.keyFacts ?? []);

  readonly sessionSummaries = computed(() =>
    [...(this.worldState()?.sessionSummaries ?? [])].sort((a, b) => b.turn - a.turn),
  );

  readonly playerCharacter = computed(() => this.worldState()?.playerCharacter ?? null);
}
