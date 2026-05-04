import type {
  ChatMessageDto,
  ChatRequestDto,
  ScenarioDto,
  ToneSettingsDto,
} from '@nx-monorepo-experiment/shared-api-contracts';
import type { ApiMessage } from '../services/openrouter-client';

const storyBeatHints: Record<string, string> = {
  inciting_incident: 'The story is just beginning. Something has changed. Build anticipation.',
  rising_tension: 'Tensions escalate. Consequences feel closer. Narrate with urgency.',
  dark_moment: 'The protagonist is in genuine danger or moral crisis. Do not soften this.',
  climax_pending: 'Multiple threads are converging. The story approaches its peak.',
  resolution: 'Major conflicts resolved. The world breathes again. Reflect consequences.',
};

export function buildSystemPrompt(scenario: ScenarioDto, worldState?: Record<string, unknown> | null): string {
  const npcList = scenario.npcs.map((npc) => `- ${npc.name}: ${npc.description}`).join('\n');
  const rules = scenario.rules.map((rule) => `- ${rule}`).join('\n');
  const worldFacts = Array.isArray(worldState?.['keyFacts'])
    ? `\nKnown facts:\n${(worldState['keyFacts'] as string[]).map((fact) => `- ${fact}`).join('\n')}`
    : '';

  return [
    'You are the narrator and game master for an interactive story.',
    `Scenario: ${scenario.title}`,
    `Setting: ${scenario.setting}`,
    `Tone: ${scenario.tone}`,
    `Player character: ${scenario.character_name} - ${scenario.character_description}`,
    npcList ? `NPCs:\n${npcList}` : '',
    rules ? `Rules:\n${rules}` : '',
    worldFacts,
    'Respond in vivid prose. Advance the scene, preserve continuity, and leave the player room to act.',
  ].filter(Boolean).join('\n\n');
}

export function buildKickoffPrompt(scenario: ScenarioDto): string {
  return `Begin "${scenario.title}" with an immediate scene for ${scenario.character_name}.`;
}

export function buildToneFragment(tone: ToneSettingsDto): string {
  const parts = [];
  if (tone.pacing === 'cinematic') {
    parts.push('Write shorter paragraphs. Cut to scene transitions quickly. Favor action over description.');
  }
  if (tone.register === 'gritty') {
    parts.push('Consequences feel heavy. Wounds matter. Dialogue is terse and real.');
  }
  if (tone.register === 'mythic') {
    parts.push('Events feel fated. Language is elevated. The world is beautiful and terrible in equal measure.');
  }
  if (tone.boundary === 'fade') {
    parts.push('Fade to black for violence and explicit content. Imply consequences, do not depict them.');
  }
  if (tone.boundary === 'unfiltered') {
    parts.push('Narrate without omission. Do not soften or fade.');
  }
  return parts.join('\n');
}

export function buildChatMessages(request: ChatRequestDto): ApiMessage[] {
  const messages: ApiMessage[] = [];

  if (request.scenario) {
    let systemPrompt = buildSystemPrompt(request.scenario, request.world_state);
    const beat = request.world_state?.['storyBeat'];
    if (typeof beat === 'string' && storyBeatHints[beat]) {
      systemPrompt += `\n[Narrative beat: ${storyBeatHints[beat]}]`;
    }
    const tone = buildToneFragment(request.tone_settings);
    if (tone) systemPrompt += `\n\n[Narrative style guidance:\n${tone}]`;
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (request.messages.length === 0 && request.scenario) {
    messages.push({ role: 'user', content: buildKickoffPrompt(request.scenario) });
    return messages;
  }

  for (const message of request.messages) {
    messages.push(toApiMessage(message, Boolean(request.scenario)));
  }

  return messages;
}

function toApiMessage(message: ChatMessageDto, hasScenario: boolean): ApiMessage {
  if (message.role === 'assistant' || !hasScenario && message.role === 'user') {
    return { role: message.role, content: message.content };
  }

  const prefix = message.input_type === 'action'
    ? '[Action]:'
    : message.input_type === 'direct'
      ? '[Direct]:'
      : message.input_type === 'remember'
        ? '[Remember]:'
        : '[Dialogue]:';
  return { role: message.role, content: `${prefix} ${message.content}` };
}
