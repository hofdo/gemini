import { Injectable, inject } from '@angular/core';
import { BondUpdate, RelationshipTier } from './bond.model';
import { WorldStateStore } from './world-state.store';

@Injectable({ providedIn: 'root' })
export class BondStateService {
  private store = inject(WorldStateStore);

  applyBondUpdate(update: BondUpdate): void {
    this.store.update(s => {
      const bondState = s.bondState;
      if (!bondState) return s;
      const newTier = Math.max(0, Math.min(5, bondState.tier + (update.tierDelta ?? 0))) as RelationshipTier;
      const anchors = update.newAnchor
        ? [...bondState.memoryAnchors, {
            id: crypto.randomUUID(),
            description: update.newAnchor,
            createdAtTurn: s.turnCount,
            playerInvokedCount: 0,
          }]
        : bondState.memoryAnchors;
      return {
        ...s,
        bondState: {
          ...bondState,
          tier: newTier,
          temperature: update.temperatureChange ?? bondState.temperature,
          memoryAnchors: anchors,
          milestones: update.newMilestone ? [...bondState.milestones, update.newMilestone] : bondState.milestones,
          companionMood: update.companionMoodUpdate ?? bondState.companionMood,
        },
        lastUpdated: new Date().toISOString(),
      };
    });
  }
}
