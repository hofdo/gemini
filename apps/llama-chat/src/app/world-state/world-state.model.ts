export type NpcStatus = 'alive' | 'dead' | 'missing' | 'unknown';
export type EventType = 'combat' | 'dialogue' | 'discovery' | 'faction' | 'world';
export type EventCertainty = 'witnessed' | 'rumored' | 'deduced' | 'false';
export type SceneTension = 'calm' | 'tense' | 'hostile' | 'combat';
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

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

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  factionControl?: string;
  currentEvents: string[];
  visitCount: number;
}

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

export interface StoryEvent {
  id: string;
  turn: number;
  title: string;
  description: string;
  type: EventType;
  certainty: EventCertainty;
  source?: string;
  involvedNpcIds: string[];
  involvedFactionIds: string[];
  locationId?: string;
}

export interface CurrentScene {
  locationId: string | null;
  presentNpcIds: string[];
  tension: SceneTension;
  sceneNote: string;
}

export interface WorldClock {
  dayNumber: number;
  timeOfDay: TimeOfDay;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  turnsPerDay: number;
}

export interface SessionSummary {
  id: string;
  turnRange: [number, number];
  summary: string;
  keyFacts: string[];
  createdAt: string;
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
}

export interface WorldStateDelta {
  factionChanges: FactionChange[];
  npcChanges: NpcChange[];
  newEvents: Omit<StoryEvent, 'id' | 'turn'>[];
  sceneUpdate: SceneUpdate | null;
  clockAdvance: boolean;
  keyFactsAppend: string[];
}

export interface FactionChange {
  factionId: string;
  standingDelta: number;
  notesAppend: string;
}

export interface NpcChange {
  npcId: string;
  newStatus: NpcStatus | null;
  dispositionDelta: number;
  newKnownFacts: string[];
  notesAppend: string;
}

export interface SceneUpdate {
  locationId: string | null;
  addNpcIds: string[];
  removeNpcIds: string[];
  newTension: SceneTension | null;
  sceneNote: string;
}
