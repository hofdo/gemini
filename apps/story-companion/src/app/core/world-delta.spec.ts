import { applyWorldDelta, makeWorldStateForScenario } from './world-delta';

describe('world-delta', () => {
  it('applies key facts, scene, npc/faction updates, events, clock, and ambient inject', () => {
    const world = makeWorldStateForScenario('world-1', {
      scenario_type: 'adventure',
      title: 'Ash Gate',
      setting: 'Gate',
      tone: 'tense',
      character_name: 'Mira',
      character_description: 'Captain',
      npcs: [{ name: 'Sable', description: 'Scout', mode: 'simple', personality: '', foes: [], friends: [], plot_twists: [] }],
      rules: [],
    });
    const next = applyWorldDelta(world, {
      key_facts_append: ['The gate is barred.', 'The gate is barred.'],
      scene_update: { location_id: 'gate', add_npc_ids: [], remove_npc_ids: [], new_tension: 'tense', scene_note: 'At the gate.' },
      npc_changes: [{ npc_id: 'sable', new_status: 'alive', disposition_delta: 5, new_known_facts: [], notes_append: '' }],
      faction_changes: [{ faction_id: 'guild', standing_delta: 3, notes_append: 'helped' }],
      new_events: [{ id: 'ev-1', turn: 1, title: 'Gate Check', description: 'The gate was inspected.', type: 'discovery', certainty: 'witnessed', source: '', involved_npc_ids: [], involved_faction_ids: [], location_id: null }],
      clock_advance: { turns: 1 },
      quest_updates: [],
      player_update: null,
      story_beat_update: null,
      ambient_inject: 'Cold wind cuts through the gatehouse.',
      npc_rumors: [],
      faction_drift: [],
      bond_update: null,
      combat_delta: null,
    });

    expect(next.keyFacts).toEqual(['The gate is barred.']);
    expect(next.currentScene?.locationId).toBe('gate');
    expect(next.npcStates?.[0].disposition).toBe(5);
    expect(next.factions?.[0].id).toBe('guild');
    expect(next.events?.[0].title).toBe('Gate Check');
    expect(next.worldClock?.dayNumber).toBe(2);
    expect(next.ambientInject).toContain('Cold wind');
  });
});
