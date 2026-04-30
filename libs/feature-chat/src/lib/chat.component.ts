import { Component, computed, effect, inject, signal, ViewChild, ElementRef, OnInit, OnDestroy, SecurityContext } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { marked } from 'marked';
import { ChatService } from './chat.service';
import { ScenarioService } from '@nx-monorepo-experiment/shared-scenario';
import { ChatAssistService } from './chat-assist.service';
import { InputType } from '@nx-monorepo-experiment/shared-scenario';
import { WorldStateService } from '@nx-monorepo-experiment/shared-world-state';
import { SessionService } from './session.service';
import { WorldPanelComponent } from '@nx-monorepo-experiment/shared-world-state';
import { LoadingBusService } from '@nx-monorepo-experiment/shared-ui';
import { CombatService } from '@nx-monorepo-experiment/shared-world-state';

interface OracleResult {
  type: 'npc_name' | 'location_name' | 'quest_hook';
  result: string;
  detail: string;
}

@Component({
  selector: 'llama-chat',
  standalone: true,
  imports: [FormsModule, WorldPanelComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  protected chatService = inject(ChatService);
  protected scenarioService = inject(ScenarioService);
  protected worldStateService = inject(WorldStateService);
  protected sessionService = inject(SessionService);
  private aiAssist = inject(ChatAssistService);
  private router = inject(Router);
  private readonly _sanitizer = inject(DomSanitizer);
  private loadingBus = inject(LoadingBusService);
  private combatService = inject(CombatService);

  protected input = signal('');
  protected inputType = signal<InputType>('dialogue');
  protected showScenarioInfo = signal(false);
  protected pendingAction = signal<'reset' | 'new' | 'change' | 'trim' | null>(null);
  protected showWorldPanel = signal(false);
  protected worldTab = signal<'scene' | 'factions' | 'npcs' | 'events'>('scene');
  protected contradictions = signal<string[]>([]);
  protected ambientLine = signal<string | null>(null);
  protected keepLast = signal(10);
  protected contextBannerDismissed = signal(false);
  protected combatPromptVisible = signal(false);

  protected oracleVisible = signal(false);
  protected oracleLoading = signal(false);
  protected oracleResults = signal<OracleResult[]>([]);

  // Fix 2A — Bond state computed signals
  readonly bondState = computed(() => this.worldStateService.state()?.bondState ?? null);
  readonly isBondMode = computed(() => this.scenarioService.activeScenario()?.scenarioType === 'interpersonal');
  readonly bondTemperaturePercent = computed(() => {
    const temp = this.bondState()?.temperature;
    // EmotionalTemperature: 'cold' | 'warm' | 'charged' | 'tender' | 'raw'
    const map: Record<string, number> = { cold: 0, warm: 25, charged: 50, tender: 75, raw: 100 };
    return temp != null ? (map[temp] ?? 0) : 0;
  });

  // Fix 2B — Bond change toast
  protected bondToast = signal<string | null>(null);
  private _bondToastTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastBondSnapshot: { tier: number; temperature: string } | null = null;

  protected readonly aiAssisting = computed(() => this.loadingBus.assistLoading());

  @ViewChild('messageList') private messageList!: ElementRef<HTMLElement>;
  @ViewChild('chatInput') private chatInput!: ElementRef<HTMLTextAreaElement>;

  private _scrollEffect = effect(() => {
    this.chatService.messages();
    this.chatService.loading();
    setTimeout(() => {
      const el = this.messageList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  });

  private _wasLoading = false;

  private _oracleKeyHandler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'O') {
      e.preventDefault();
      this.toggleOracle();
    }
    if (e.key === 'Escape') {
      if (this.oracleVisible()) {
        this.oracleVisible.set(false);
      }
      if (this.combatPromptVisible()) {
        this.combatPromptVisible.set(false);
      }
    }
  };

  private _deltaEffect = effect(() => {
    const loading = this.chatService.loading();
    if (!loading && this._wasLoading) {
      this._wasLoading = false;
      const messages = this.chatService.messages();
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant') {
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        this.sessionService.onTurnComplete(lastMsg.content, lastUserMsg?.inputType).then(() => {
          const ambient = this.worldStateService.consumeAmbient();
          if (ambient) {
            this.ambientLine.set(ambient.text);
            setTimeout(() => this.ambientLine.set(null), 8000);
          }
          const found = this.worldStateService.detectContradictions(lastMsg.content);
          if (found.length) this.contradictions.set(found);
          const ws = this.worldStateService.state();
          if (ws?.currentScene?.tension === 'combat' && !ws?.combatState?.active) {
            this.combatPromptVisible.set(true);
          }
        });
      }
    }
    if (loading) this._wasLoading = true;
  });

  // Fix 2B — watch bondState changes and flash a toast
  private _bondEffect = effect(() => {
    const bs = this.bondState();
    if (!bs) return;
    // effect() runs on every change; track transitions by comparing snapshot
    const prev = this._lastBondSnapshot;
    this._lastBondSnapshot = { tier: bs.tier, temperature: bs.temperature };
    if (prev === null) return; // first run — no toast
    if (prev.tier === bs.tier && prev.temperature === bs.temperature) return;
    const msg = `Bond changed: Tier ${bs.tier} — ${bs.temperature}`;
    this.bondToast.set(msg);
    if (this._bondToastTimer !== null) clearTimeout(this._bondToastTimer);
    this._bondToastTimer = setTimeout(() => this.bondToast.set(null), 3000);
  });

  ngOnInit(): void {
    const scenario = this.scenarioService.activeScenario();
    if (!scenario) {
      this.router.navigate(['/']);
      return;
    }
    this.worldStateService.loadForScenario(scenario.title).then(loaded => {
      if (!loaded) {
        this.worldStateService.initForScenario(scenario);
      }
      this.chatService.loadPersistedMessages();
      if (this.chatService.messages().length === 0) {
        this.chatService.initializeStory();
      }
    });
    document.addEventListener('keydown', this._oracleKeyHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this._oracleKeyHandler);
  }

  renderMarkdown(content: string): string {
    const processed = content.replace(
      /<think>([\s\S]*?)<\/think>/g,
      (_match, inner) =>
        `\n\n<details class="think-block"><summary>💭 Thinking…</summary>\n\n${inner.trim()}\n\n</details>\n\n`,
    );
    return this._sanitizer.sanitize(SecurityContext.HTML, marked.parse(processed) as string) ?? '';
  }

  focusInput(): void {
    setTimeout(() => this.chatInput?.nativeElement?.focus(), 0);
  }

  toggleInputType(): void {
    this.inputType.update((t) => {
      if (t === 'dialogue') return 'action';
      if (t === 'action') return 'direct';
      return 'dialogue';
    });
    this.focusInput();
  }

  toggleScenarioInfo(): void {
    this.showScenarioInfo.update((v) => !v);
  }

  requestReset(): void {
    if (this.chatService.messages().length === 0) return;
    this.pendingAction.set('reset');
  }

  requestNew(): void {
    this.pendingAction.set('new');
  }

  requestChange(): void {
    if (this.chatService.messages().length === 0) {
      this.executeChange();
      return;
    }
    this.pendingAction.set('change');
  }

  requestTrim(): void {
    this.pendingAction.set('trim');
  }

  exportAndReset(): void {
    this.worldStateService.exportToFile();
    this.chatService.resetMessages();
    this.chatService.initializeStory();
    this.contextBannerDismissed.set(true);
  }

  dismissContextBanner(): void {
    this.contextBannerDismissed.set(true);
  }

  confirmAction(): void {
    const action = this.pendingAction();
    this.pendingAction.set(null);
    switch (action) {
      case 'reset':
        this.chatService.resetMessages();
        this.chatService.initializeStory();
        break;
      case 'new':
        this.chatService.resetMessages();
        this.scenarioService.clearScenario();
        this.router.navigate(['/']);
        break;
      case 'change':
        this.executeChange();
        break;
      case 'trim':
        this.chatService.trimContext(this.keepLast());
        this.contextBannerDismissed.set(true);
        break;
    }
  }

  cancelAction(): void {
    this.pendingAction.set(null);
  }

  private executeChange(): void {
    this.chatService.resetMessages();
    const mode = this.scenarioService.activeScenario()?.scenarioType ?? 'adventure';
    this.router.navigate(['/scenario', mode]);
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.chatService.loading()) return;
    this.input.set('');
    this.contextBannerDismissed.set(false);
    this.chatService.sendMessage(text, this.inputType());
    this.focusInput();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  onInput(event: Event): void {
    this.input.set((event.target as HTMLTextAreaElement).value);
  }

  toggleWorldPanel(): void {
    this.showWorldPanel.update(v => !v);
  }

  setWorldTab(tab: 'scene' | 'factions' | 'npcs' | 'events'): void {
    this.worldTab.set(tab);
  }

  dismissContradictions(): void {
    this.contradictions.set([]);
  }

  async enterCombat(): Promise<void> {
    this.combatPromptVisible.set(false);
    const ws = this.worldStateService.state();
    if (!ws) return;
    const npcIds = ws.currentScene?.presentNpcIds ?? [];
    await this.combatService.startCombat(npcIds);
  }

  async aiSuggestOrRewrite(): Promise<void> {
    if (this.aiAssisting() || this.chatService.loading()) return;
    this.loadingBus.set('assist', true);
    try {
      const currentText = this.input().trim();
      const messages = this.chatService.messages();
      const inputType = this.inputType();
      const result = currentText
        ? await this.aiAssist.rewriteInput(currentText, messages, inputType)
        : await this.aiAssist.suggestInput(messages, inputType);
      this.input.set(result);
      this.focusInput();
    } catch (err) {
      console.error('AI assist error', err);
    } finally {
      this.loadingBus.set('assist', false);
    }
  }

  protected toggleOracle(): void {
    this.oracleVisible.update(v => !v);
  }

  protected async generateOracle(type: 'npc_name' | 'location_name' | 'quest_hook'): Promise<void> {
    if (this.oracleLoading()) return;
    this.oracleLoading.set(true);
    try {
      const ws = this.worldStateService.state();
      const scenario = this.scenarioService.activeScenario();
      const summary = ws
        ? `Location: ${ws.currentScene?.locationId ?? 'unknown'}, Tension: ${ws.currentScene?.tension ?? 'calm'}, Factions: ${ws.factions.map(f => f.name).slice(0, 3).join(', ')}`
        : '';
      const response = await fetch('/generate-oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oracle_type: type,
          world_state_summary: summary,
          scenario_title: scenario?.title ?? '',
          setting: scenario?.setting ?? '',
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data?.result?.trim()) {
        this.oracleResults.update(results => [
          { type, result: data.result, detail: data.detail },
          ...results.slice(0, 9),
        ]);
      }
    } catch (err) {
      console.warn('Oracle generation failed', err);
    } finally {
      this.oracleLoading.set(false);
    }
  }
}
