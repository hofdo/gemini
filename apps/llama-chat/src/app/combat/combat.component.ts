import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CombatService } from './combat.service';
import { WorldStateService } from '../world-state/world-state.service';
import { InitiativeTrackerComponent } from './initiative-tracker/initiative-tracker.component';
import { CombatLogComponent } from './combat-log/combat-log.component';
import { ActionPanelComponent } from './action-panel/action-panel.component';

@Component({
  selector: 'llama-combat',
  standalone: true,
  imports: [InitiativeTrackerComponent, CombatLogComponent, ActionPanelComponent],
  templateUrl: './combat.component.html',
  styleUrl: './combat.component.scss',
})
export class CombatComponent implements OnInit {
  protected combatService = inject(CombatService);
  protected worldStateService = inject(WorldStateService);
  private router = inject(Router);

  protected loading = signal(false);
  protected lastNarrative = signal<string | null>(null);
  protected outcome = signal<'victory' | 'flee' | 'tpk' | null>(null);
  // Fix 3C: surface resolve-turn failures to the user
  protected combatError = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.combatService.combatActive()) {
      this.router.navigate(['/chat']);
    }
  }

  protected async onAction(actionText: string): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.combatError.set(null);
    try {
      const result = await this.combatService.resolveTurn(actionText);
      if (result) {
        this.lastNarrative.set(result.narrative);
        const cs = this.worldStateService.state()?.combatState;
        if (cs) {
          const allEnemiesDead = cs.initiativeOrder
            .filter(p => !p.isPlayer)
            .every(p => p.hp.current <= 0);
          if (allEnemiesDead) {
            this.outcome.set('victory');
          }
        }
      } else {
        // Fix 3C: null return means the HTTP call failed — inform the user
        this.combatError.set('Turn resolution failed. Check the proxy connection and try again.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected async endCombat(outcome: 'victory' | 'flee' | 'tpk'): Promise<void> {
    await this.combatService.endCombat(outcome);
  }
}
