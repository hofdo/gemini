export interface CombatParticipant {
  entityId: string;
  name: string;
  initiative: number;
  hp: { current: number; max: number };
  isPlayer: boolean;
}

export interface CombatState {
  active: boolean;
  round: number;
  initiativeOrder: CombatParticipant[];
  activeEntityIndex: number;
  log: string[];
}

export interface CombatDelta {
  action: 'start' | 'next_turn' | 'end';
  hpChanges?: { entityId: string; hpDelta: number }[];
  roundLogAppend?: string;
  removedEntityIds?: string[];
}
