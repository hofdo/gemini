import { Injectable } from '@angular/core';
import { WorldState, WorldStateDelta } from '@nx-monorepo-experiment/shared-world-state';

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

  // Phase 3a: World tick / heartbeat
  async worldTick(worldState: WorldState, scenario: unknown): Promise<WorldStateDelta> {
    const response = await fetch('/world-state/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, world_state: worldState }),
    });
    if (!response.ok) throw new Error(`World tick failed: ${response.status}`);
    return response.json() as Promise<WorldStateDelta>;
  }

  async generateSummary(
    worldState: WorldState,
    scenario: unknown,
    messages: { role: string; content: string; inputType?: string }[]
  ): Promise<{ summary: string; keyFacts: string[] } | null> {
    const response = await fetch(`${this.baseUrl}/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario,
        world_state: worldState,
        last_messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          input_type: m.inputType ?? 'dialogue',
        })),
      }),
    });
    if (!response.ok) return null;
    return response.json();
  }
}
