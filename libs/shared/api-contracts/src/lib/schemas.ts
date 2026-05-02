import { z } from 'zod';

export const inputTypeSchema = z.enum(['dialogue', 'action', 'direct', 'remember']);
export const scenarioTypeSchema = z.enum(['adventure', 'interpersonal']);

export const npcStatsSchema = z.object({
  str: z.number().int().optional(),
  dex: z.number().int().optional(),
  con: z.number().int().optional(),
  int: z.number().int().optional(),
  wis: z.number().int().optional(),
  cha: z.number().int().optional(),
});

export const npcSchema = z.object({
  name: z.string(),
  description: z.string(),
  mode: z.enum(['simple', 'detailed']).default('simple'),
  stats: npcStatsSchema.optional().nullable(),
  personality: z.string().default(''),
  foes: z.array(z.string()).default([]),
  friends: z.array(z.string()).default([]),
  plot_twists: z.array(z.string()).default([]),
});

export const scenarioSchema = z.object({
  scenario_type: scenarioTypeSchema.default('adventure'),
  title: z.string(),
  setting: z.string(),
  tone: z.string(),
  character_name: z.string(),
  character_description: z.string(),
  npcs: z.array(npcSchema).default([]),
  rules: z.array(z.string()).default([]),
  partner_name: z.string().default(''),
  partner_gender: z.string().default(''),
  partner_personality: z.string().default(''),
  partner_body_description: z.string().default(''),
  partner_appearance: z.string().default(''),
  partner_relationship: z.string().default(''),
  partner_likes: z.string().default(''),
  partner_dislikes: z.string().default(''),
  partner_turn_ons: z.string().default(''),
});

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  input_type: inputTypeSchema.default('dialogue'),
});

export const toneSettingsSchema = z.object({
  pacing: z.enum(['cinematic', 'deliberate']).default('deliberate'),
  register: z.enum(['gritty', 'balanced', 'mythic']).default('balanced'),
  boundary: z.enum(['fade', 'standard', 'unfiltered']).default('standard'),
});

export const backendConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  model: z.string(),
  temperature: z.number().default(0.8),
  top_p: z.number().default(0.95),
  top_k: z.number().int().default(50),
  repeat_penalty: z.number().default(1),
  min_p: z.number().optional(),
  system_prompt_style: z.string().optional(),
  context_window: z.number().int().optional(),
});

export const providerConfigResponseSchema = z.object({
  backends: z.array(backendConfigSchema),
  active_id: z.string(),
});

const eventTypeSchema = z.enum(['combat', 'dialogue', 'discovery', 'faction', 'world']);
const certaintySchema = z.enum(['witnessed', 'rumored', 'deduced', 'false']);
const sceneTensionSchema = z.enum(['calm', 'tense', 'hostile', 'combat']);

export const storyEventSchema = z.object({
  id: z.string().default(''),
  turn: z.number().int().default(0),
  title: z.string(),
  description: z.string(),
  type: eventTypeSchema.default('world'),
  certainty: certaintySchema.default('witnessed'),
  source: z.string().default(''),
  involved_npc_ids: z.array(z.string()).default([]),
  involved_faction_ids: z.array(z.string()).default([]),
  location_id: z.string().nullable().default(null),
});

export const factionChangeSchema = z.object({
  faction_id: z.string(),
  standing_delta: z.number().int().default(0),
  notes_append: z.string().default(''),
});

export const npcChangeSchema = z.object({
  npc_id: z.string(),
  new_status: z.enum(['alive', 'dead', 'missing', 'unknown']).nullable().default(null),
  disposition_delta: z.number().int().default(0),
  new_known_facts: z.array(z.string()).default([]),
  notes_append: z.string().default(''),
});

export const sceneUpdateSchema = z.object({
  location_id: z.string().nullable().default(null),
  add_npc_ids: z.array(z.string()).default([]),
  remove_npc_ids: z.array(z.string()).default([]),
  new_tension: sceneTensionSchema.nullable().default(null),
  scene_note: z.string().default(''),
});

export const worldStateDeltaSchema = z.object({
  faction_changes: z.array(factionChangeSchema).default([]),
  npc_changes: z.array(npcChangeSchema).default([]),
  new_events: z.array(storyEventSchema).default([]),
  scene_update: sceneUpdateSchema.nullable().default(null),
  clock_advance: z.object({ turns: z.number().int().default(1) }).nullable().default(null),
  key_facts_append: z.array(z.string()).default([]),
  quest_updates: z.array(z.unknown()).default([]),
  player_update: z.unknown().nullable().default(null),
  story_beat_update: z.string().nullable().default(null),
  ambient_inject: z.string().nullable().default(null),
  npc_rumors: z.array(storyEventSchema).default([]),
  faction_drift: z.array(factionChangeSchema).default([]),
  bond_update: z.unknown().nullable().default(null),
  combat_delta: z.unknown().nullable().default(null),
});

export const worldStateSchema = z.object({
  id: z.string(),
  scenario_title: z.string(),
}).passthrough();

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema),
  scenario: scenarioSchema.nullable().optional(),
  world_state: worldStateSchema.nullable().optional(),
  stream: z.boolean().default(false),
  enable_thinking: z.boolean().default(false),
  tone_settings: toneSettingsSchema.default({
    pacing: 'deliberate',
    register: 'balanced',
    boundary: 'standard',
  }),
});

export const assistRequestSchema = z.object({
  mode: z.enum(['suggest', 'rewrite']),
  current_text: z.string().default(''),
  input_type: inputTypeSchema.default('dialogue'),
  scenario: scenarioSchema.nullable().optional(),
  messages: z.array(chatMessageSchema).default([]),
});

export const generateScenarioRequestSchema = z.object({
  description: z.string(),
  scenario_type: scenarioTypeSchema.default('adventure'),
});

export const generateNpcRequestSchema = z.object({
  npc_name: z.string().default(''),
  npc_description: z.string().default(''),
  setting: z.string().default(''),
  tone: z.string().default(''),
  title: z.string().default(''),
});

export const generateQuestRequestSchema = z.object({
  prompt: z.string(),
  setting: z.string().default(''),
  tone: z.string().default(''),
  party_level: z.number().int().nullable().optional(),
});

export const oracleTypeSchema = z.enum(['npc_name', 'location_name', 'quest_hook']);

export const generateOracleRequestSchema = z.object({
  oracle_type: oracleTypeSchema,
  world_state_summary: z.string().default(''),
  scenario_title: z.string().default(''),
  setting: z.string().default(''),
});

export const generateOracleResponseSchema = z.object({
  oracle_type: oracleTypeSchema,
  result: z.string(),
  detail: z.string().default(''),
});

export const worldStateUpdateRequestSchema = z.object({
  scenario: scenarioSchema,
  world_state: worldStateSchema,
  last_exchanges: z.array(chatMessageSchema),
});

export const backendPatchRequestSchema = z.object({
  id: z.string(),
});

export const generateFactionSetRequestSchema = z.object({
  scenario: scenarioSchema.optional(),
  setting: z.string().default(''),
  tone: z.string().default(''),
});

export const generateFactionSetResponseSchema = z.object({
  factions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    standing: z.number().default(50),
  })).min(1),
});

export const generateOpeningSceneRequestSchema = z.object({
  scenario: scenarioSchema.optional(),
  setting: z.string().default(''),
  tone: z.string().default(''),
});

export const generateOpeningSceneResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  opening_line: z.string(),
  tension: z.enum(['low', 'medium', 'high', 'extreme']),
});

export const combatantSchema = z.object({
  id: z.string(),
  name: z.string(),
  hp: z.number(),
});

export const combatResolveTurnRequestSchema = z.object({
  action: z.string(),
  combatants: z.array(combatantSchema).default([]),
  round: z.number().int().default(1),
  scenario: scenarioSchema.optional(),
});

export const combatResolveTurnResponseSchema = z.object({
  narrative: z.string(),
  hp_changes: z.record(z.string(), z.number()).default({}),
  status_changes: z.record(z.string(), z.string()).default({}),
  round_end: z.boolean().default(false),
});

export type BackendConfig = z.infer<typeof backendConfigSchema>;
export type ChatMessageDto = z.infer<typeof chatMessageSchema>;
export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
export type ScenarioDto = z.infer<typeof scenarioSchema>;
export type ToneSettingsDto = z.infer<typeof toneSettingsSchema>;
export type WorldStateDeltaDto = z.infer<typeof worldStateDeltaSchema>;
export type GenerateOracleRequestDto = z.infer<typeof generateOracleRequestSchema>;
export type GenerateOracleResponseDto = z.infer<typeof generateOracleResponseSchema>;
export type GenerateFactionSetRequestDto = z.infer<typeof generateFactionSetRequestSchema>;
export type GenerateFactionSetResponseDto = z.infer<typeof generateFactionSetResponseSchema>;
export type GenerateOpeningSceneRequestDto = z.infer<typeof generateOpeningSceneRequestSchema>;
export type GenerateOpeningSceneResponseDto = z.infer<typeof generateOpeningSceneResponseSchema>;
export type CombatResolveTurnRequestDto = z.infer<typeof combatResolveTurnRequestSchema>;
export type CombatResolveTurnResponseDto = z.infer<typeof combatResolveTurnResponseSchema>;
export type NpcDto = z.infer<typeof npcSchema>;
