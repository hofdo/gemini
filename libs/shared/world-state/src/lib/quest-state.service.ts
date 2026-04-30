import { Injectable, inject } from '@angular/core';
import { QuestEntry, QuestUpdate } from './quest.model';
import { WorldStateStore } from './world-state.store';

@Injectable({ providedIn: 'root' })
export class QuestStateService {
  private store = inject(WorldStateStore);

  addQuest(quest: Omit<QuestEntry, 'id' | 'addedAtTurn'>): void {
    this.store.update(s => ({
      ...s,
      questLog: [...s.questLog, { ...quest, id: crypto.randomUUID(), addedAtTurn: s.turnCount }],
      lastUpdated: new Date().toISOString(),
    }));
  }

  updateQuestObjective(questId: string, objectiveIndex: number, done: boolean): void {
    this.store.update(s => ({
      ...s,
      questLog: s.questLog.map(q => q.id === questId
        ? { ...q, objectives: q.objectives.map((o, i) => i === objectiveIndex ? { ...o, done } : o) }
        : q),
      lastUpdated: new Date().toISOString(),
    }));
  }

  applyQuestUpdates(updates: QuestUpdate[], currentTurnCount: number): void {
    this.store.update(s => ({
      ...s,
      questLog: s.questLog.map(q => {
        const update = updates.find(u => u.questId === q.id);
        if (!update) return q;
        const objectivesDone = update.objectivesDone;
        const objectives = objectivesDone
          ? q.objectives.map((o, i) => objectivesDone.includes(i) ? { ...o, done: true } : o)
          : q.objectives;
        return {
          ...q,
          status: update.newStatus ?? q.status,
          objectives,
          resolvedAtTurn: update.newStatus && update.newStatus !== 'active' ? currentTurnCount : q.resolvedAtTurn,
        };
      }),
      lastUpdated: new Date().toISOString(),
    }));
  }
}
