import { describe, expect, it } from '@jest/globals';

import {
  chatRequestSchema,
  combatResolveTurnRequestSchema,
  combatResolveTurnResponseSchema,
  generateFactionSetResponseSchema,
  generateOpeningSceneResponseSchema,
  providerConfigResponseSchema,
  generateOracleRequestSchema,
  generateOracleResponseSchema,
  scenarioSchema,
  worldStateDeltaSchema,
} from './schemas';

describe('shared API contracts', () => {
  it('validates the current chat request payload shape from the Angular client', () => {
    const parsed = chatRequestSchema.parse({
      messages: [
        {
          role: 'user',
          content: 'Open the door.',
          input_type: 'action',
        },
      ],
      stream: true,
      scenario: {
        scenario_type: 'adventure',
        title: 'Ash Gate',
        setting: 'A burned city gate under black rain.',
        tone: 'tense',
        character_name: 'Mira',
        character_description: 'A watch captain with a broken oath.',
        npcs: [],
        rules: ['Keep consequences persistent.'],
      },
      world_state: null,
      enable_thinking: false,
      tone_settings: {
        pacing: 'deliberate',
        register: 'balanced',
        boundary: 'standard',
      },
    });

    expect(parsed.messages[0].input_type).toBe('action');
    expect(parsed.scenario?.character_name).toBe('Mira');
  });

  it('applies defaults for generated scenario and world delta DTOs', () => {
    const scenario = scenarioSchema.parse({
      title: 'Lantern Road',
      setting: 'An old pilgrim road.',
      tone: 'mythic',
      character_name: 'Ivo',
      character_description: 'A tired sword hand.',
    });
    const delta = worldStateDeltaSchema.parse({});

    expect(scenario.scenario_type).toBe('adventure');
    expect(scenario.npcs).toEqual([]);
    expect(delta.faction_changes).toEqual([]);
    expect(delta.scene_update).toBeNull();
  });

  it('accepts legacy partner fields and strips them from parsed scenarios', () => {
    const scenario = scenarioSchema.parse({
      title: 'Lantern Road',
      setting: 'An old pilgrim road.',
      tone: 'mythic',
      character_name: 'Ivo',
      character_description: 'A tired sword hand.',
      partner_name: 'Lena',
      partner_relationship: 'ally',
      partner_personality: 'steady',
    });

    expect('partner_name' in scenario).toBe(false);
    expect('partner_relationship' in scenario).toBe(false);
    expect(scenario.title).toBe('Lantern Road');
  });

  it('validates provider configuration responses', () => {
    const parsed = providerConfigResponseSchema.parse({
      backends: [
        {
          id: 'local',
          name: 'Local',
          url: 'http://localhost:8080',
          model: 'local-model',
          temperature: 0.8,
          top_p: 0.95,
          top_k: 50,
          repeat_penalty: 1,
          context_window: 8192,
        },
      ],
      active_id: 'local',
    });

    expect(parsed.active_id).toBe('local');
  });

  it('validates oracle request and response payloads', () => {
    const request = generateOracleRequestSchema.parse({
      oracle_type: 'npc_name',
    });
    const response = generateOracleResponseSchema.parse({
      oracle_type: 'npc_name',
      result: 'Mara',
      detail: 'A scarred scout',
    });

    expect(request.oracle_type).toBe('npc_name');
    expect(response.result).toBe('Mara');
  });

  it('validates generate-faction-set response schema with 3 factions and defaults', () => {
    const result = generateFactionSetResponseSchema.parse({
      factions: [
        { id: 'iron-guild', name: 'Iron Guild', description: 'Merchants of war.' },
        { id: 'ash-council', name: 'Ash Council', description: 'Survivors.' },
        { id: 'silent-watch', name: 'Silent Watch', description: 'Keepers.' },
      ],
    });

    expect(result.factions).toHaveLength(3);
    expect(result.factions[0].standing).toBe(50);
    expect(result.factions[1].id).toBe('ash-council');
  });

  it('accepts generate-faction-set response with fewer than 3 factions', () => {
    const result = generateFactionSetResponseSchema.parse({
      factions: [
        { id: 'one', name: 'One', description: 'First.' },
        { id: 'two', name: 'Two', description: 'Second.' },
      ],
    });
    expect(result.factions).toHaveLength(2);
  });

  it('rejects generate-faction-set response with empty factions array', () => {
    expect(() =>
      generateFactionSetResponseSchema.parse({ factions: [] }),
    ).toThrow();
  });

  it('validates generate-opening-scene response schema with tension enum', () => {
    const result = generateOpeningSceneResponseSchema.parse({
      title: 'The Burning Gate',
      description: 'The gate smolders under black rain.',
      opening_line: 'The fire has not gone out.',
      tension: 'high',
    });

    expect(result.title).toBe('The Burning Gate');
    expect(result.tension).toBe('high');
  });

  it('rejects opening-scene response with invalid tension value', () => {
    expect(() =>
      generateOpeningSceneResponseSchema.parse({
        title: 'Test',
        description: 'Desc',
        opening_line: 'Line',
        tension: 'calm',
      }),
    ).toThrow();
  });

  it('validates combat resolve-turn request and response schemas', () => {
    const request = combatResolveTurnRequestSchema.parse({
      action: 'Strike the guard.',
      combatants: [
        { id: 'mira', name: 'Mira', hp: 30 },
        { id: 'guard-1', name: 'Guard', hp: 15 },
      ],
      round: 1,
    });

    const response = combatResolveTurnResponseSchema.parse({
      narrative: 'Mira lands a blow.',
      hp_changes: { 'guard-1': -8 },
      status_changes: {},
      round_end: false,
    });

    expect(request.round).toBe(1);
    expect(request.combatants).toHaveLength(2);
    expect(response.narrative).toBe('Mira lands a blow.');
    expect(response.hp_changes['guard-1']).toBe(-8);
    expect(response.round_end).toBe(false);
  });

  it('applies combat resolve-turn response defaults when optional fields omitted', () => {
    const response = combatResolveTurnResponseSchema.parse({
      narrative: 'The action resolves.',
    });

    expect(response.hp_changes).toEqual({});
    expect(response.status_changes).toEqual({});
    expect(response.round_end).toBe(false);
  });

  it('accepts adventure world-state deltas with events scene clock and factions', () => {
    const delta = worldStateDeltaSchema.parse({
      faction_changes: [{ faction_id: 'guild', standing_delta: 5, notes_append: 'helped' }],
      scene_update: { location_id: 'gate', new_tension: 'tense', scene_note: 'At the gate.' },
      clock_advance: { turns: 1 },
      key_facts_append: ['The gate is barred.'],
    });

    expect(delta.faction_changes).toHaveLength(1);
    expect(delta.scene_update?.location_id).toBe('gate');
  });
});
