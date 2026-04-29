export type { CombatDelta, CombatParticipant, CombatState } from './combat.model';
export type { BondState, BondUpdate, EmotionalTemperature, MemoryAnchor, RelationshipTier } from './bond.model';
export type { FactionChange, Faction } from './faction.model';
export type { NpcChange, NpcRelationship, NpcState, NpcStatus } from './npc.model';
export type { PlayerCharacter, PlayerUpdate } from './player.model';
export type { QuestEntry, QuestUpdate } from './quest.model';
export type { AmbientEvent, EventCertainty, EventType, SceneTension, StoryBeat, StoryEvent, TimeOfDay } from './story.model';

import { BondState, BondUpdate } from './bond.model';
import { CombatDelta, CombatState } from './combat.model';
import { Faction, FactionChange } from './faction.model';
import { NpcChange, NpcState } from './npc.model';
import { PlayerCharacter, PlayerUpdate } from './player.model';
import { QuestEntry, QuestUpdate } from './quest.model';
import { AmbientEvent, SceneTension, StoryBeat, StoryEvent, TimeOfDay } from './story.model';

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  factionControl?: string;
  currentEvents: string[];
  visitCount: number;
}

export interface WorldClock {
  dayNumber: number;
  timeOfDay: TimeOfDay;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  turnsPerDay: number;
}

export interface CurrentScene {
  locationId: string | null;
  presentNpcIds: string[];
  tension: SceneTension;
  sceneNote: string;
}

export interface SessionSummary {
  id: string;
  turnRange: [number, number];
  summary: string;
  keyFacts: string[];
  createdAt: string;
}

// WorldState schema v2: clockAdvance changed from boolean to ClockAdvance | null
export interface ClockAdvance {
  turns: number;
}

export interface SceneUpdate {
  locationId: string | null;
  addNpcIds: string[];
  removeNpcIds: string[];
  newTension: SceneTension | null;
  sceneNote: string;
}

export interface WorldState {
  _schemaVersion: number;
  id: string;
  scenarioTitle: string;
  currentScene: CurrentScene | null;
  worldClock: WorldClock;
  factions: Faction[];
  locations: WorldLocation[];
  npcStates: NpcState[];
  storyEvents: StoryEvent[];
  archivedEventCount: number;
  archivedEventSummary: string;
  keyFacts: string[];
  sessionSummaries: SessionSummary[];
  turnCount: number;
  lastUpdated: string;
  questLog: QuestEntry[];
  playerCharacter: PlayerCharacter | null;
  choiceChronicle: string[];
  storyBeat: StoryBeat;
  ambientQueue: AmbientEvent[];
  bondState: BondState | null;
  combatState: CombatState | null;
}

export interface WorldStateDelta {
  factionChanges: FactionChange[];
  npcChanges: NpcChange[];
  newEvents: Omit<StoryEvent, 'id' | 'turn'>[];
  sceneUpdate: SceneUpdate | null;
  clockAdvance: ClockAdvance | null;
  keyFactsAppend: string[];
  questUpdates: QuestUpdate[];
  playerUpdate: PlayerUpdate | null;
  storyBeatUpdate: StoryBeat;
  // Phase 3a: Heartbeat additions
  ambientInject: string | null;
  npcRumors: Omit<StoryEvent, 'id' | 'turn'>[];
  factionDrift: FactionChange[];
  // Phase 3d: Bond mode
  bondUpdate: BondUpdate | null;
  combatDelta: CombatDelta | null;
}
