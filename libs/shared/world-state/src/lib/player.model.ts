export interface PlayerCharacter {
  name: string;
  epithets: string[];
  aptitudes: {
    bold: number;
    subtle: number;
    learned: number;
    connected: number;
    fierce: number;
    resilient: number;
  };
  scarsAndGlories: string[];
  inventory: string[];
  conditions: string[];
  hp: { current: number; max: number };
}

export interface PlayerUpdate {
  hpDelta?: number;
  conditionsAdd?: string[];
  conditionsRemove?: string[];
  inventoryAdd?: string[];
  inventoryRemove?: string[];
}
