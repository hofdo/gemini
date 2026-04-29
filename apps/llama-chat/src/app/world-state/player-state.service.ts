import { Injectable, inject } from '@angular/core';
import { PlayerUpdate } from './player.model';
import { WorldStateStore } from './world-state.store';

@Injectable({ providedIn: 'root' })
export class PlayerStateService {
  private store = inject(WorldStateStore);

  applyPlayerUpdate(update: PlayerUpdate): void {
    this.store.update(s => {
      const playerCharacter = s.playerCharacter;
      if (!playerCharacter) return s;
      const newHp = update.hpDelta
        ? { ...playerCharacter.hp, current: Math.max(0, Math.min(playerCharacter.hp.max, playerCharacter.hp.current + update.hpDelta)) }
        : playerCharacter.hp;
      const conditions = [
        ...playerCharacter.conditions.filter(c => !update.conditionsRemove?.includes(c)),
        ...(update.conditionsAdd ?? []),
      ];
      const inventory = [
        ...playerCharacter.inventory.filter(i => !update.inventoryRemove?.includes(i)),
        ...(update.inventoryAdd ?? []),
      ];
      return {
        ...s,
        playerCharacter: { ...playerCharacter, hp: newHp, conditions, inventory },
        lastUpdated: new Date().toISOString(),
      };
    });
  }
}
