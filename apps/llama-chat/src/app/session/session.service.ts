import { Injectable, inject, signal } from '@angular/core';
import { WorldStateService } from '../world-state/world-state.service';
import { ScenarioService } from '../scenario/scenario.service';
import { WorldSyncService } from '../shared/world-sync.service';
import { ChatService } from '../chat/chat.service';
import { SessionSummary } from '../world-state/world-state.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private worldStateService = inject(WorldStateService);
  private scenarioService = inject(ScenarioService);
  private worldSyncService = inject(WorldSyncService);
  private chatService = inject(ChatService);

  readonly mode = signal<'adventure' | 'interpersonal' | 'combat' | 'journal'>('adventure');

  async onTurnComplete(lastMessage: string): Promise<void> {
    const ws = this.worldStateService.state();
    if (!ws) return;
    const scenario = this.scenarioService.activeScenario();
    if (!scenario) return;
    const messages = this.chatService.messages();
    const lastExchanges = messages.slice(-6);
    if (lastExchanges.length === 0) return;

    if (!this.worldSyncService.shouldTriggerUpdate(lastMessage, ws)) return;

    try {
      const delta = await this.worldSyncService.updateWorldState({
        scenario: this.chatService.buildScenarioPayload(scenario),
        world_state: ws,
        last_exchanges: lastExchanges.map(m => ({
          role: m.role,
          content: m.content,
          input_type: m.inputType ?? 'dialogue',
        })),
      });
      this.worldStateService.applyDelta(delta);
    } catch (err) {
      console.warn('World state update failed (non-blocking)', err);
    }

    await this.maybeSummarize(ws.turnCount);
  }

  async maybeSummarize(turnCount: number): Promise<void> {
    if (turnCount % 20 !== 0) return;
    const ws = this.worldStateService.state();
    const scenario = this.scenarioService.activeScenario();
    if (!ws || !scenario) return;
    const messages = this.chatService.messages();
    const last20 = messages.slice(-20);
    if (last20.length < 10) return; // not enough content yet
    try {
      const result = await this.worldSyncService.generateSummary(
        ws,
        this.chatService.buildScenarioPayload(scenario),
        last20,
      );
      if (result) {
        const summary: SessionSummary = {
          id: crypto.randomUUID(),
          turnRange: [Math.max(0, ws.turnCount - 20), ws.turnCount],
          summary: result.summary,
          keyFacts: result.keyFacts,
          createdAt: new Date().toISOString(),
        };
        this.worldStateService.addSessionSummary(summary);
      }
    } catch (err) {
      console.warn('Session summary failed (non-blocking)', err);
    }
  }
}
