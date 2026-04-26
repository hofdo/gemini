export interface DmNpcStats {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  [key: string]: number | undefined;
}

export interface DmNpcClass {
  name: string;
  level: number;
}

export interface DmNpcAction {
  name: string;
  description: string;
}

export interface DmNpc {
  id: string;
  name: string;
  race: string;
  description: string;
  personality: string;
  alignment: string;
  cr: string;
  classes: DmNpcClass[];
  stats: DmNpcStats;
  savingThrows: string[];
  skills: string[];
  equipment: string[];
  actions: DmNpcAction[];
  foes: string[];
  friends: string[];
  plotTwists: string[];
}

export interface QuestMonster {
  name: string;
  cr: string; // Challenge Rating, e.g. "1/4", "1/2", "2", "10"
}

export interface QuestEncounter {
  description: string;
  monsters: QuestMonster[];
}

export interface QuestReward {
  gold: number;
  silver: number;
  items: string[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  rewards: QuestReward;
  encounters: QuestEncounter[];
  difficulty: string;
  setting: string;
  estimatedDuration: string;
  partyLevel: number | null;
  xpBudget: number | null;
}

export interface DmCollection {
  npcs: DmNpc[];
  quests: Quest[];
}

export interface GeneratedNpcRaw {
  name: string;
  race: string;
  description: string;
  personality: string;
  alignment: string;
  cr: string;
  classes: Array<{ name: string; level: number }>;
  stats: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number };
  saving_throws: string[];
  skills: string[];
  equipment: string[];
  actions: Array<{ name: string; description: string }>;
  foes: string[];
  friends: string[];
  plot_twists: string[];
}
