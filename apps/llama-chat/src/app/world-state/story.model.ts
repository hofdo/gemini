// Phase 3a: Heartbeat / ambient queue
export interface AmbientEvent {
  text: string;
  generatedAt: string;
}

export type StoryBeat =
  | 'inciting_incident'
  | 'rising_tension'
  | 'dark_moment'
  | 'climax_pending'
  | 'resolution'
  | null;

export type EventType = 'combat' | 'dialogue' | 'discovery' | 'faction' | 'world';
export type EventCertainty = 'witnessed' | 'rumored' | 'deduced' | 'false';
export type SceneTension = 'calm' | 'tense' | 'hostile' | 'combat';
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

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
