import { Injectable, inject, signal } from '@angular/core';
import { WorldStateService } from '../world-state/world-state.service';
import { ScenarioService } from '../scenario/scenario.service';
import { WorldSyncService } from '../shared/world-sync.service';
import { ChatService } from '../chat/chat.service';
import { SessionSummary, WorldState } from '../world-state/world-state.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private worldStateService = inject(WorldStateService);
  private scenarioService = inject(ScenarioService);
  private worldSyncService = inject(WorldSyncService);
  private chatService = inject(ChatService);

  readonly mode = signal<'adventure' | 'interpersonal' | 'combat' | 'journal'>('adventure');

  async onTurnComplete(lastMessage: string, inputType?: string): Promise<void> {
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
      // Phase 5: auto-transition to combat when scene tension hits 'combat'
      const wsAfter = this.worldStateService.state();
      if (wsAfter?.currentScene?.tension === 'combat' && !wsAfter?.combatState?.active) {
        console.info('[SessionService] Scene tension reached combat — combatState not yet active');
      }
    } catch (err) {
      console.warn('World state update failed (non-blocking)', err);
    }

    // Phase 3a: fire world tick on direct (director) inputs
    if (inputType === 'direct') {
      this.fireTick().catch(err => console.warn('Tick failed', err));
    }

    // Phase 3b: story beat detection
    const beat = this.detectStoryBeat();
    const currentBeat = this.worldStateService.state()?.storyBeat;
    if (beat !== currentBeat) {
      this.worldStateService.setStoryBeat(beat);
    }

    await this.maybeSummarize(ws.turnCount);
  }

  // Phase 3a: fire world tick heartbeat
  async fireTick(): Promise<void> {
    const ws = this.worldStateService.state();
    const scenario = this.scenarioService.activeScenario();
    if (!ws || !scenario) return;
    const delta = await this.worldSyncService.worldTick(ws, this.chatService.buildScenarioPayload(scenario));
    this.worldStateService.applyDelta(delta);
  }

  // Phase 3b: detect story beat from world state
  private detectStoryBeat(): WorldState['storyBeat'] {
    const ws = this.worldStateService.state();
    if (!ws) return null;

    const recentEvents = ws.storyEvents.slice(-10);
    const recentFactionEvents = recentEvents.filter(e => e.type === 'faction').length;
    const hostileFactions = ws.factions.filter(f => f.standing <= -40).length;
    const hostileNpcs = ws.npcStates.filter(n => n.disposition <= -40).length;
    const playerHp = ws.playerCharacter?.hp;
    const hpCritical = playerHp ? playerHp.current / playerHp.max < 0.3 : false;

    if (hpCritical || hostileFactions >= 2) return 'dark_moment';
    if (recentFactionEvents >= 2 || hostileNpcs >= 2) return 'rising_tension';
    if (ws.turnCount <= 5 && recentEvents.some(e => e.certainty === 'witnessed')) return 'inciting_incident';
    if (ws.turnCount > 10 && hostileFactions === 0 && hostileNpcs === 0) return 'resolution';
    return null;
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
