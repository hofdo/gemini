import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ScenarioService } from '../scenario/scenario.service';
import { WorldStateService } from '../world-state/world-state.service';
import { CombatParticipant, CombatState, PlayerCharacter } from '../world-state/world-state.model';
import { Scenario } from '../scenario/scenario.model';

export interface CombatResolution {
  narrative: string;
  hp_changes: { entityId: string; hpDelta: number }[];
  status_changes: { entityId: string; newStatus: string }[];
  round_end: boolean;
}

@Injectable({ providedIn: 'root' })
export class CombatService {
  private worldStateService = inject(WorldStateService);
  private scenarioService = inject(ScenarioService);
  private router = inject(Router);

  readonly combatActive = computed(() => this.worldStateService.state()?.combatState?.active ?? false);
  readonly initiative = computed(() => this.worldStateService.state()?.combatState?.initiativeOrder ?? []);
  readonly currentRound = computed(() => this.worldStateService.state()?.combatState?.round ?? 1);
  readonly activeEntity = computed(() => {
    const cs = this.worldStateService.state()?.combatState;
    if (!cs || !cs.active) return null;
    return cs.initiativeOrder[cs.activeEntityIndex] ?? null;
  });
  readonly combatLog = computed(() => this.worldStateService.state()?.combatState?.log ?? []);

  async startCombat(participantNpcIds: string[]): Promise<void> {
    const worldState = this.worldStateService.state();
    if (!worldState) return;

    const participants: CombatParticipant[] = [];

    // Add player — derive from scenario if no PlayerCharacter has been set (e.g. adventure mode without Session Zero)
    const pc = worldState.playerCharacter
      ?? this.derivePlayerCharacterFromScenario(this.scenarioService.activeScenario());
    participants.push({
      entityId: 'player',
      name: pc?.name ?? 'Player',
      initiative: this.rollInitiative(10),
      hp: pc?.hp ?? { current: 20, max: 20 },
      isPlayer: true,
    });

    // Add NPCs
    for (const npcId of participantNpcIds) {
      const npc = worldState.npcStates.find(n => n.npcId === npcId);
      if (!npc) {
        console.warn(`CombatService.startCombat: unknown npcId "${npcId}" skipped`);
        continue;
      }
      participants.push({
        entityId: npcId,
        name: npc.name,
        initiative: this.rollInitiative(8),
        hp: {
          current: (npc as unknown as { stats?: { maxHp?: number } }).stats?.maxHp ?? 15,
          max: (npc as unknown as { stats?: { maxHp?: number } }).stats?.maxHp ?? 15,
        },
        isPlayer: false,
      });
    }

    // Sort by initiative descending
    const sorted = participants.sort((a, b) => b.initiative - a.initiative);

    const combatState: CombatState = {
      active: true,
      round: 1,
      initiativeOrder: sorted,
      activeEntityIndex: 0,
      log: ['Combat begins!'],
    };

    this.worldStateService.setCombatState(combatState);
    await this.router.navigate(['/combat']);
  }

  async resolveTurn(actionText: string): Promise<CombatResolution | null> {
    const worldState = this.worldStateService.state();
    const currentCombatState = worldState?.combatState;
    if (!currentCombatState?.active) return null;

    const roll = Math.floor(Math.random() * 20) + 1;
    const scenario = this.scenarioService.activeScenario();

    const body = {
      scenario: scenario ? this.buildScenarioPayload(scenario) : null,
      world_state: worldState,
      combat_state: currentCombatState,
      action_text: actionText,
      active_entity_id: this.activeEntity()?.entityId ?? 'player',
      dice_roll: roll,
    };

    try {
      const response = await fetch('/combat/resolve-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.warn(`CombatService.resolveTurn: request failed with status ${response.status}`);
        return null;
      }

      const res = (await response.json()) as CombatResolution;

      // Apply HP changes and advance turn locally
      this.worldStateService.applyCombatDelta({
        action: 'next_turn',
        hpChanges: res.hp_changes,
        roundLogAppend: res.narrative,
        removedEntityIds: res.status_changes
          .filter(s => s.newStatus === 'dead')
          .map(s => s.entityId),
      });

      // Fix 1C: guard against out-of-bounds activeEntityIndex after entity removal
      const updatedCs = this.worldStateService.state()?.combatState;
      if (updatedCs) {
        const order = updatedCs.initiativeOrder;
        if (order.length > 0 && updatedCs.activeEntityIndex >= order.length) {
          this.worldStateService.setCombatState({
            ...updatedCs,
            activeEntityIndex: Math.max(0, order.length - 1),
          });
        }
      }

      return res;
    } catch (err) {
      console.warn('CombatService.resolveTurn: fetch error', err);
      return null;
    }
  }

  async endCombat(outcome: 'victory' | 'flee' | 'tpk'): Promise<void> {
    const combatState = this.worldStateService.state()?.combatState;
    if (!combatState?.active) return;

    this.worldStateService.applyCombatDelta({
      action: 'end',
      roundLogAppend: `Combat ended: ${outcome}`,
    });

    // Reset all combat state so re-entering combat starts fresh (Fix 1D)
    const currentState = this.worldStateService.state()?.combatState;
    if (currentState) {
      this.worldStateService.setCombatState({
        ...currentState,
        active: false,
        initiativeOrder: [],
        activeEntityIndex: 0,
        round: 0,
      });
    }

    await this.router.navigate(['/chat']);
  }

  private derivePlayerCharacterFromScenario(scenario: Scenario | null): PlayerCharacter {
    return {
      name: scenario?.characterName ?? 'Adventurer',
      epithets: [],
      aptitudes: {
        bold: 0,
        subtle: 0,
        learned: 0,
        connected: 0,
        fierce: 0,
        resilient: 0,
      },
      scarsAndGlories: [],
      inventory: [],
      conditions: [],
      hp: { current: 20, max: 20 },
    };
  }

  private rollInitiative(bonus: number): number {
    return Math.floor(Math.random() * 20) + 1 + bonus;
  }

  private buildScenarioPayload(scenario: NonNullable<ReturnType<ScenarioService['activeScenario']>>) {
    return {
      scenario_type: scenario.scenarioType ?? 'adventure',
      title: scenario.title,
      setting: scenario.setting,
      tone: scenario.tone,
      character_name: scenario.characterName,
      character_description: scenario.characterDescription,
      npcs: (scenario.npcs ?? []).map(n => ({
        name: n.name,
        description: n.description,
        mode: n.mode ?? 'simple',
        stats: n.stats,
        personality: n.personality ?? '',
        foes: n.foes ?? [],
        friends: n.friends ?? [],
        plot_twists: n.plotTwists ?? [],
      })),
      rules: scenario.rules,
      partner_name: scenario.partnerName ?? '',
      partner_gender: scenario.partnerGender ?? '',
      partner_personality: scenario.partnerPersonality ?? '',
      partner_body_description: scenario.partnerBodyDescription ?? '',
      partner_appearance: scenario.partnerAppearance ?? '',
      partner_relationship: scenario.partnerRelationship ?? '',
      partner_likes: scenario.partnerLikes ?? '',
      partner_dislikes: scenario.partnerDislikes ?? '',
      partner_turn_ons: scenario.partnerTurnOns ?? '',
    };
  }
}
