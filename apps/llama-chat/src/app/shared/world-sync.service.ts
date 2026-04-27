import { Injectable } from '@angular/core';
import { WorldState, WorldStateDelta } from '../world-state/world-state.model';

interface WorldStateUpdateRequest {
  scenario: unknown;
  world_state: WorldState;
  last_exchanges: { role: string; content: string; input_type: string }[];
}

@Injectable({ providedIn: 'root' })
export class WorldSyncService {
  private readonly baseUrl = '/world-state';

  shouldTriggerUpdate(lastMessage: string, worldState: WorldState): boolean {
    const knownNames = new Set([
      ...worldState.npcStates.map(n => n.name),
      ...worldState.factions.map(f => f.name),
      ...worldState.locations.map(l => l.name),
    ]);
    return [...knownNames].some(name => lastMessage.includes(name));
  }

  async updateWorldState(request: WorldStateUpdateRequest): Promise<WorldStateDelta> {
    const response = await fetch(`${this.baseUrl}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`World state update failed: ${response.status}`);
    return response.json() as Promise<WorldStateDelta>;
  }
}
