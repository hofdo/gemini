import { DmNpc, Quest } from './dm.model';
import { NpcState, QuestEntry } from '../world-state/world-state.model';

export function dmNpcToNpcState(dmNpc: DmNpc): NpcState {
  return {
    npcId: dmNpc.id,
    name: dmNpc.name,
    status: 'alive',
    disposition: 0,
    relationships: [],
    knownFacts: [],
    notes: [
      dmNpc.personality,
      `CR ${dmNpc.cr}`,
      dmNpc.classes.map(c => `${c.name} ${c.level}`).join('/'),
    ].filter(Boolean).join(' | '),
    locationId: undefined,
  };
}

export function dmQuestToQuestEntry(quest: Quest): Omit<QuestEntry, 'id' | 'addedAtTurn'> {
  return {
    title: quest.title,
    description: quest.description,
    status: 'active',
    objectives: quest.objectives.map(o => ({ text: o, done: false })),
    linkedNpcIds: [],
    rewards: { gold: quest.rewards.gold, items: quest.rewards.items },
  };
}
