import { Injectable, inject } from '@angular/core';
import { NpcChange, NpcState } from './npc.model';
import { WorldStateStore } from './world-state.store';

@Injectable({ providedIn: 'root' })
export class NpcStateService {
  private store = inject(WorldStateStore);

  addNpcState(npcState: NpcState): void {
    this.store.update(s => ({
      ...s,
      npcStates: [...s.npcStates, npcState],
      lastUpdated: new Date().toISOString(),
    }));
  }

  updateNpcState(id: string, patch: Partial<NpcState>): void {
    this.store.update(s => ({
      ...s,
      npcStates: s.npcStates.map(n => n.npcId === id ? { ...n, ...patch } : n),
      lastUpdated: new Date().toISOString(),
    }));
  }

  applyNpcChanges(validChanges: NpcChange[]): void {
    this.store.update(s => ({
      ...s,
      npcStates: s.npcStates.map(n => {
        const change = validChanges.find(c => c.npcId === n.npcId);
        if (!change) return n;
        const clampedDelta = Math.max(-25, Math.min(25, change.dispositionDelta));
        return {
          ...n,
          status: change.newStatus ?? n.status,
          disposition: Math.max(-100, Math.min(100, n.disposition + clampedDelta)),
          knownFacts: [...n.knownFacts, ...change.newKnownFacts],
          notes: change.notesAppend ? `${n.notes}\n${change.notesAppend}`.trim() : n.notes,
        };
      }),
      lastUpdated: new Date().toISOString(),
    }));
  }
}
