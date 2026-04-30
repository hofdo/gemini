export interface QuestEntry {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  objectives: { text: string; done: boolean }[];
  addedAtTurn: number;
  resolvedAtTurn?: number;
  linkedNpcIds: string[];
  rewards?: { gold?: number; items?: string[] };
}

export interface QuestUpdate {
  questId: string;
  newStatus?: QuestEntry['status'];
  objectivesDone?: number[];
  notesAppend?: string;
}
