import { Component, Input } from '@angular/core';
import { CombatParticipant } from '../../world-state/combat.model';

@Component({
  selector: 'llama-initiative-tracker',
  standalone: true,
  template: `
    <div class="initiative-tracker">
      <h3 class="round-header">Round {{ round }}</h3>
      <ul class="initiative-list">
        @for (participant of participants; track participant.entityId; let i = $index) {
          <li class="initiative-entry"
              [class.active]="i === activeEntityIndex"
              [class.dead]="participant.hp.current <= 0">
            <span class="participant-name">{{ participant.name }}</span>
            @if (participant.isPlayer) {
              <span class="player-badge">PC</span>
            }
            <div class="hp-bar-wrapper">
              <div class="hp-bar"
                   [style.width.%]="hpPercent(participant)"
                   [class.hp-low]="hpPercent(participant) < 30">
              </div>
            </div>
            <span class="hp-label">{{ participant.hp.current }}/{{ participant.hp.max }}</span>
            <span class="initiative-value">init: {{ participant.initiative }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class InitiativeTrackerComponent {
  @Input() participants: CombatParticipant[] = [];
  @Input() activeEntityIndex = 0;
  @Input() round = 1;

  hpPercent(participant: CombatParticipant): number {
    if (participant.hp.max <= 0) return 0;
    return Math.max(0, Math.min(100, (participant.hp.current / participant.hp.max) * 100));
  }
}
