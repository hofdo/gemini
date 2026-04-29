export type NpcStatus = 'alive' | 'dead' | 'missing' | 'unknown';

export interface NpcRelationship {
  targetNpcId: string;
  disposition: number;
  note: string;
}

export interface NpcState {
  npcId: string;
  name: string;
  status: NpcStatus;
  locationId?: string;
  disposition: number;
  relationships: NpcRelationship[];
  knownFacts: string[];
  notes: string;
}

export interface NpcChange {
  npcId: string;
  newStatus: NpcStatus | null;
  dispositionDelta: number;
  newKnownFacts: string[];
  notesAppend: string;
}
