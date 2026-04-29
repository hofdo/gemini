import { Injectable, inject } from '@angular/core';
import { CombatDelta, CombatState } from './combat.model';
import { WorldStateStore } from './world-state.store';

@Injectable({ providedIn: 'root' })
export class CombatStateService {
  private store = inject(WorldStateStore);

  setCombatState(cs: CombatState | null): void {
    this.store.update(s => ({
      ...s,
      combatState: cs,
      lastUpdated: new Date().toISOString(),
    }));
  }

  applyCombatDelta(delta: CombatDelta): void {
    if (delta.action === 'start') {
      // CombatService sets state directly via setCombatState — nothing to do here
      return;
    }

    this.store.update(current => {
      if (!current.combatState) return current;
      const cs = current.combatState;

      if (delta.action === 'next_turn') {
        const removedIds = new Set(delta.removedEntityIds ?? []);
        let order = cs.initiativeOrder.filter(p => !removedIds.has(p.entityId));

        if (delta.hpChanges?.length) {
          order = order.map(p => {
            const change = delta.hpChanges?.find(c => c.entityId === p.entityId);
            if (!change) return p;
            return {
              ...p,
              hp: {
                ...p.hp,
                current: Math.max(0, Math.min(p.hp.max, p.hp.current + change.hpDelta)),
              },
            };
          });
        }

        const nextIndex = order.length > 0
          ? (cs.activeEntityIndex + 1) % order.length
          : 0;

        const log = delta.roundLogAppend
          ? [...cs.log, delta.roundLogAppend]
          : cs.log;

        return {
          ...current,
          combatState: { ...cs, initiativeOrder: order, activeEntityIndex: nextIndex, log },
          lastUpdated: new Date().toISOString(),
        };
      }

      if (delta.action === 'end') {
        const log = delta.roundLogAppend
          ? [...cs.log, delta.roundLogAppend]
          : cs.log;

        return {
          ...current,
          combatState: { ...cs, active: false, log },
          lastUpdated: new Date().toISOString(),
        };
      }

      return current;
    });
  }
}
