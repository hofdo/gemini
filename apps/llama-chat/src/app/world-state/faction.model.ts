export interface Faction {
  id: string;
  name: string;
  description: string;
  archetypes: string[];
  standing: number;
  territories: string[];
  allies: string[];
  enemies: string[];
  notes: string;
}

export interface FactionChange {
  factionId: string;
  standingDelta: number;
  notesAppend: string;
}
