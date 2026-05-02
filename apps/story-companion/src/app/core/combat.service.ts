import { inject, Injectable } from '@angular/core';
import type { CombatResolveTurnResponseDto } from '@nx-monorepo-experiment/shared-api-contracts';
import { newId } from './story-factories';
import { StorySessionService } from './story-session.service';

@Injectable({ providedIn: 'root' })
export class CombatService {
  private readonly story = inject(StorySessionService);
  private _resolving = false;

  async startCombat(npcIds: string[]): Promise<void> {
    const session = this.story.activeSession();
    if (!session) return;

    const combat = {
      active: true,
      round: 1,
      initiativeOrder: npcIds,
      activeEntityIndex: 0,
      log: [] as Array<{ round: number; actor: string; narrative: string }>,
    };

    await this.story.setCombatState(combat);
  }

  async resolveTurn(actionText: string): Promise<void> {
    if (this._resolving) return;
    const session = this.story.activeSession();
    if (!session) return;

    const combat = session.worldState.combat;
    if (!combat?.active) return;

    this._resolving = true;

    const npcStates = session.worldState.npcStates ?? [];
    const combatants = combat.initiativeOrder
      .map((id) => {
        const npc = npcStates.find((n) => n.npcId === id);
        return npc ? { id: npc.npcId, name: npc.name, hp: 10 } : null;
      })
      .filter((c): c is { id: string; name: string; hp: number } => c !== null);

    let response: Response;
    try {
      response = await fetch('/combat/resolve-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionText,
          combatants,
          round: combat.round,
          scenario: session.scenario,
        }),
      });
    } catch (err) {
      this._resolving = false;
      throw err;
    }

    if (!response.ok) {
      this._resolving = false;
      throw new Error(`HTTP ${response.status}`);
    }

    const result: CombatResolveTurnResponseDto = await response.json();

    // Re-read session after async call to avoid stale state
    const freshSession = this.story.activeSession();
    if (!freshSession) return;
    const freshCombat = freshSession.worldState.combat;
    if (!freshCombat?.active) return;

    // Append to combat log
    const activeActor = freshCombat.initiativeOrder[freshCombat.activeEntityIndex] ?? 'unknown';
    const updatedLog = [
      ...freshCombat.log,
      { round: freshCombat.round, actor: activeActor, narrative: result.narrative },
    ];

    // Advance initiative index (wrap around) and increment round if needed
    const nextIndex = (freshCombat.activeEntityIndex + 1) % freshCombat.initiativeOrder.length;
    const nextRound = result.round_end ? freshCombat.round + 1 : freshCombat.round;

    const updatedCombat = {
      ...freshCombat,
      round: nextRound,
      activeEntityIndex: nextIndex,
      log: updatedLog,
    };

    await this.story.setCombatState(updatedCombat);
    this._resolving = false;

    // Apply hp_changes and status_changes to npcStates
    const currentSession = this.story.activeSession();
    if (!currentSession) return;

    for (const npc of currentSession.worldState.npcStates ?? []) {
      const hpDelta = result.hp_changes[npc.npcId];
      const newStatus = result.status_changes[npc.npcId];

      if (hpDelta !== undefined || newStatus) {
        let updatedStatus = npc.status;
        if (newStatus) {
          updatedStatus = newStatus;
        } else if (hpDelta !== undefined && hpDelta < 0 && updatedStatus === 'alive') {
          updatedStatus = 'injured';
        }
        await this.story.addNpcToSession({
          npcId: npc.npcId,
          name: npc.name,
          status: updatedStatus,
          disposition: npc.disposition,
        });
      }
    }
  }

  async endCombat(outcome: 'victory' | 'flee' | 'tpk'): Promise<void> {
    const session = this.story.activeSession();
    if (!session) return;

    const combat = session.worldState.combat;
    if (!combat) return;

    await this.story.setCombatState({ ...combat, active: false });

    const turnCount = session.messages.filter((m) => m.role === 'user').length;
    const outcomeDescriptions: Record<string, string> = {
      victory: 'The party emerged victorious from combat.',
      flee: 'The party fled from combat.',
      tpk: 'The party was defeated in combat.',
    };

    try {
      await this.story.appendWorldEvent({
        id: newId('event'),
        title: 'Combat Ended',
        description: outcomeDescriptions[outcome] ?? outcome,
        type: 'combat',
        turn: turnCount,
        certainty: 'confirmed',
        source: 'combat',
        involved_npc_ids: [],
        involved_faction_ids: [],
        location_id: null,
      });
    } catch {
      // non-fatal — combat is already deactivated; navigation must proceed
    }
  }
}
