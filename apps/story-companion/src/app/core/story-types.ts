import type { ChatMessageDto, ScenarioDto, WorldStateDeltaDto } from '@nx-monorepo-experiment/shared-api-contracts';

export type ProviderMode = 'local' | 'puter';
export type InputMode = ChatMessageDto['input_type'];
export type OracleType = 'npc_name' | 'location_name' | 'quest_hook';

export interface StoryMessage extends ChatMessageDto {
  id: string;
  createdAt: string;
  failed?: boolean;
}

export interface StoryWorldState {
  id: string;
  scenario_title: string;
  currentScene?: {
    locationId: string | null;
    tension: 'calm' | 'tense' | 'hostile' | 'combat';
    sceneNote: string;
  } | null;
  worldClock?: {
    dayNumber: number;
    timeOfDay: string;
    season: string;
  };
  keyFacts?: string[];
  factions?: Array<{ id: string; name: string; standing: number; notes: string[] }>;
  npcStates?: Array<{ npcId: string; name: string; status: string; disposition: number }>;
  events?: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    turn: number;
    certainty?: string;
    source?: string;
    involved_npc_ids?: string[];
    involved_faction_ids?: string[];
    location_id?: string | null;
  }>;
  questLog?: Array<{ id: string; title: string; status: string }>;
  sessionSummaries?: Array<{ turn: number; summary: string; keyFacts: string[]; createdAt: string }>;
  ambientInject?: string | null;
  npcRumors?: Array<{ id: string; title: string; description: string }>;
  playerCharacter?: { name: string; description: string; hp?: number | null; aptitudes?: string[] };
  storyBeat?: string | null;
  combat?: {
    active: boolean;
    round: number;
    initiativeOrder: string[];
    activeEntityIndex: number;
    log: Array<{ round: number; actor: string; narrative: string }>;
  } | null;
}

export interface StorySession {
  id: string;
  title: string;
  providerMode: ProviderMode;
  scenario: ScenarioDto;
  messages: StoryMessage[];
  worldState: StoryWorldState;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSettings {
  mode: ProviderMode;
  localBackendId: string | null;
  enableThinking: boolean;
  toneSettings: {
    pacing: 'cinematic' | 'deliberate';
    register: 'gritty' | 'balanced' | 'mythic';
    boundary: 'fade' | 'standard' | 'unfiltered';
  };
}

export interface ScenarioGenerationRequest {
  prompt: string;
  scenarioType: 'adventure';
}

export interface StoryChatRequest {
  session: StorySession;
  messages: StoryMessage[];
}

export interface StoryOracleRequest {
  oracleType: OracleType;
  worldStateSummary?: string;
  scenarioTitle?: string;
  setting?: string;
}

export interface StoryOracleResult {
  oracle_type: OracleType;
  result: string;
  detail: string;
}

export interface StoryProvider {
  generateScenario(request: ScenarioGenerationRequest): Promise<ScenarioDto>;
  streamChat(request: StoryChatRequest): AsyncIterable<string>;
  extractWorldDelta(request: StoryChatRequest): Promise<WorldStateDeltaDto>;
  summarizeSession(request: StoryChatRequest): Promise<{ summary: string; keyFacts: string[] }>;
  generateOracle(request: StoryOracleRequest): Promise<StoryOracleResult>;
  cancelGeneration(): void;
}
