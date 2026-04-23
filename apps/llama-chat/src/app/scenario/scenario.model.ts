export type InputType = 'dialogue' | 'action' | 'direct';
export type ScenarioType = 'adventure' | 'interpersonal';
export type NpcMode = 'simple' | 'detailed';

export interface NpcStats {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
}

export interface Npc {
  name: string;
  description: string;
  mode: NpcMode;
  stats?: NpcStats;
  personality?: string;
  foes?: string[];
  friends?: string[];
  plotTwists?: string[];
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
  partnerGender?: string;
  partnerPersonality?: string;
  partnerBodyDescription?: string;
  partnerAppearance?: string;
  partnerRelationship?: string;
  partnerLikes?: string;
  partnerDislikes?: string;
  partnerTurnOns?: string;
}
