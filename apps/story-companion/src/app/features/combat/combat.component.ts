import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CombatService } from '../../core/combat.service';
import { StorySessionService } from '../../core/story-session.service';

@Component({
  selector: 'story-combat',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrl: './combat.component.scss',
  template: `
    <div class="combat-container">
      <header class="combat-header">
        <a [routerLink]="['/workspace', sessionId()]" class="back-link">← Back to Workspace</a>
        <h1>Combat</h1>
      </header>

      @if (error()) {
        <div class="combat-error" role="alert">{{ error() }}</div>
      }

      @if (outcome()) {
        <div class="combat-outcome-overlay">
          <div class="outcome-card">
            <h2>{{ outcomeTitle() }}</h2>
            <p>{{ outcomeMessage() }}</p>
          </div>
        </div>
      }

      <!-- Start combat panel: shown when no active combat -->
      @if (!combatState()?.active && !outcome()) {
        <section class="start-combat-panel">
          <h2>Start Combat</h2>
          @if (availableNpcs().length === 0) {
            <p class="no-npcs">No NPCs in world state. Add NPCs via the DM Tools first.</p>
          } @else {
            <p>Select combatants:</p>
            <ul class="npc-select-list">
              @for (npc of availableNpcs(); track npc.npcId) {
                <li>
                  <label>
                    <input
                      type="checkbox"
                      [checked]="isSelected(npc.npcId)"
                      (change)="toggleNpc(npc.npcId)"
                    />
                    {{ npc.name }} <span class="npc-status">({{ npc.status }})</span>
                  </label>
                </li>
              }
            </ul>
            <button
              class="btn-primary"
              [disabled]="loading() || selectedNpcIds().length === 0"
              (click)="onStartCombat()"
            >
              {{ loading() ? 'Starting…' : 'Start Combat' }}
            </button>
          }
        </section>
      }

      <!-- Active combat panel -->
      @if (combatState()?.active) {
        <section class="active-combat-panel">
          <div class="combat-meta">
            <span class="round-badge">Round {{ combatState()!.round }}</span>
          </div>

          <!-- Initiative tracker -->
          <div class="initiative-tracker">
            <h3>Initiative Order</h3>
            <ol>
              @for (id of combatState()!.initiativeOrder; track id; let i = $index) {
                <li [class.active-turn]="i === combatState()!.activeEntityIndex">
                  {{ npcNameById(id) }}
                  @if (i === combatState()!.activeEntityIndex) {
                    <span class="turn-marker">◀ Acting</span>
                  }
                </li>
              }
            </ol>
          </div>

          <!-- Combat log -->
          <div class="combat-log">
            <h3>Combat Log</h3>
            @if (combatState()!.log.length === 0) {
              <p class="log-empty">No actions yet.</p>
            } @else {
              <ul>
                @for (entry of combatState()!.log; track $index) {
                  <li>
                    <span class="log-round">[Round {{ entry.round }}]</span>
                    <span class="log-actor">{{ npcNameById(entry.actor) }}:</span>
                    {{ entry.narrative }}
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Action input -->
          <div class="action-section">
            <textarea
              class="action-input"
              rows="3"
              placeholder="Describe your action…"
              [value]="actionInput()"
              (input)="actionInput.set($any($event.target).value)"
              [disabled]="loading()"
            ></textarea>
            <div class="action-buttons">
              <button
                class="btn-primary"
                [disabled]="loading() || !actionInput().trim()"
                (click)="onResolveTurn()"
              >
                {{ loading() ? 'Resolving…' : 'Resolve Turn' }}
              </button>
              <button
                class="btn-secondary"
                [disabled]="loading()"
                (click)="onEndCombat('flee')"
              >
                Flee
              </button>
              <button
                class="btn-danger"
                [disabled]="loading()"
                (click)="onEndCombat('victory')"
              >
                End Combat (Victory)
              </button>
            </div>
          </div>
        </section>
      }
    </div>
  `,
})
export class CombatComponent {
  private readonly combatService = inject(CombatService);
  readonly story = inject(StorySessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionInput = signal('');
  readonly selectedNpcIds = signal<string[]>([]);
  readonly outcome = signal<'victory' | 'flee' | 'tpk' | null>(null);

  readonly sessionId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  readonly combatState = computed(() => this.story.activeSession()?.worldState?.combat ?? null);

  readonly availableNpcs = computed(() => this.story.activeSession()?.worldState?.npcStates ?? []);

  readonly outcomeTitle = computed(() => {
    const o = this.outcome();
    if (o === 'victory') return 'Victory!';
    if (o === 'flee') return 'Retreated';
    if (o === 'tpk') return 'Defeated';
    return '';
  });

  readonly outcomeMessage = computed(() => {
    const o = this.outcome();
    if (o === 'victory') return 'The party emerged victorious from combat.';
    if (o === 'flee') return 'The party fled from combat.';
    if (o === 'tpk') return 'The party was defeated in combat.';
    return '';
  });

  npcNameById(id: string): string {
    const npc = this.availableNpcs().find((n) => n.npcId === id);
    return npc?.name ?? id;
  }

  isSelected(npcId: string): boolean {
    return this.selectedNpcIds().includes(npcId);
  }

  toggleNpc(npcId: string): void {
    const current = this.selectedNpcIds();
    if (current.includes(npcId)) {
      this.selectedNpcIds.set(current.filter((id) => id !== npcId));
    } else {
      this.selectedNpcIds.set([...current, npcId]);
    }
  }

  async onStartCombat(): Promise<void> {
    if (this.loading() || this.selectedNpcIds().length === 0) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.combatService.startCombat(this.selectedNpcIds());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onResolveTurn(): Promise<void> {
    const action = this.actionInput().trim();
    if (this.loading() || !action) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.combatService.resolveTurn(action);
      this.actionInput.set('');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onEndCombat(outcomeValue: 'victory' | 'flee' | 'tpk'): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.combatService.endCombat(outcomeValue);
      this.outcome.set(outcomeValue);
      const id = this.sessionId();
      setTimeout(() => {
        void this.router.navigate(['/workspace', id]);
      }, 1500);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
