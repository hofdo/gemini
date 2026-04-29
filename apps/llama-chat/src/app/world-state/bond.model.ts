// Phase 3d: Bond Mode Engine
export type RelationshipTier = 0 | 1 | 2 | 3 | 4 | 5;
export type EmotionalTemperature = 'cold' | 'warm' | 'charged' | 'tender' | 'raw';

export interface MemoryAnchor {
  id: string;
  description: string;
  createdAtTurn: number;
  playerInvokedCount: number;
}

export interface BondState {
  tier: RelationshipTier;
  temperature: EmotionalTemperature;
  memoryAnchors: MemoryAnchor[];
  milestones: string[];
  companionMood: string;
}

export interface BondUpdate {
  tierDelta?: number;
  temperatureChange?: EmotionalTemperature;
  newMilestone?: string;
  newAnchor?: string;
  companionMoodUpdate?: string;
}
