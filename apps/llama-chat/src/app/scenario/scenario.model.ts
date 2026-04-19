export type InputType = 'dialogue' | 'action';
export type ScenarioType = 'adventure' | 'interpersonal';

export interface Npc {
  name: string;
  description: string;
}

export interface Scenario {
  scenarioType: ScenarioType;
  title: string;
  setting: string;
  tone: string;
  characterName: string;
  characterDescription: string;
  npcs: Npc[];
  rules: string[];
  // Interpersonal fields
  partnerName?: string;
  partnerDescription?: string;
  relationship?: string;
}

