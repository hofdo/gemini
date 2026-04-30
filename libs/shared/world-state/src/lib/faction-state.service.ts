import { Injectable, inject } from '@angular/core';
import { Faction, FactionChange } from './faction.model';
import { WorldStateStore } from './world-state.store';

@Injectable({ providedIn: 'root' })
export class FactionStateService {
  private store = inject(WorldStateStore);

  addFaction(faction: Omit<Faction, 'id'>): void {
    const id = crypto.randomUUID();
    this.store.update(s => ({
      ...s,
      factions: [...s.factions, { ...faction, id }],
      lastUpdated: new Date().toISOString(),
    }));
  }

  updateFaction(id: string, patch: Partial<Faction>): void {
    this.store.update(s => ({
      ...s,
      factions: s.factions.map(f => f.id === id ? { ...f, ...patch } : f),
      lastUpdated: new Date().toISOString(),
    }));
  }

  applyFactionChanges(validChanges: FactionChange[]): void {
    this.store.update(s => ({
      ...s,
      factions: s.factions.map(f => {
        const change = validChanges.find(c => c.factionId === f.id);
        if (!change) return f;
        const clampedDelta = Math.max(-25, Math.min(25, change.standingDelta));
        return {
          ...f,
          standing: Math.max(-100, Math.min(100, f.standing + clampedDelta)),
          notes: change.notesAppend ? `${f.notes}\n${change.notesAppend}`.trim() : f.notes,
        };
      }),
      lastUpdated: new Date().toISOString(),
    }));
  }
}
