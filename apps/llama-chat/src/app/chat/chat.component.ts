import { Component, computed, effect, inject, signal, ViewChild, ElementRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SecurityContext } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { marked } from 'marked';
import { ChatService } from './chat.service';
import { ScenarioService } from '../scenario/scenario.service';
import { AiAssistService } from '../shared/ai-assist.service';
import { InputType } from '../scenario/scenario.model';
import { WorldStateService } from '../world-state/world-state.service';
import { WorldState } from '../world-state/world-state.model';

@Component({
  selector: 'llama-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit {
  protected chatService = inject(ChatService);
  protected scenarioService = inject(ScenarioService);
  protected worldStateService = inject(WorldStateService);
  private aiAssist = inject(AiAssistService);
  private router = inject(Router);
  private readonly _sanitizer = inject(DomSanitizer);

  protected input = signal('');
  protected inputType = signal<InputType>('dialogue');
  protected showScenarioInfo = signal(false);
  protected aiAssisting = signal(false);
  protected pendingAction = signal<'reset' | 'new' | 'change' | 'trim' | null>(null);
  protected showWorldPanel = signal(false);
  protected worldTab = signal<'scene' | 'factions' | 'npcs' | 'events'>('scene');
  protected contradictions = signal<string[]>([]);

  protected readonly loadingStates = computed(() => ({
    chat: this.chatService.loading(),
    aiAssist: this.aiAssisting(),
  }));

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

  private _deltaEffect = effect(() => {
    const loading = this.chatService.loading();
    if (!loading && this._wasLoading) {
      this._wasLoading = false;
      this.triggerWorldStateUpdate();
    }
    if (loading) this._wasLoading = true;
  });

  ngOnInit(): void {
    const scenario = this.scenarioService.activeScenario();
    if (!scenario) {
      this.router.navigate(['/']);
      return;
    }
    if (!this.worldStateService.loadForScenario(scenario.title)) {
      this.worldStateService.initForScenario(scenario);
    }
    this.chatService.loadPersistedMessages();
    if (this.chatService.messages().length === 0) {
      this.chatService.initializeStory();
    }
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
        this.chatService.trimContext();
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

  protected standingLabel(v: number): string {
    if (v >= 75)  return 'Allied';
    if (v >= 40)  return 'Friendly';
    if (v >= 10)  return 'Neutral+';
    if (v >= -10) return 'Neutral';
    if (v >= -40) return 'Unfriendly';
    if (v >= -75) return 'Hostile';
    return 'Enemy';
  }

  protected standingColor(v: number): string {
    if (v >= 40)  return '#4caf50';
    if (v >= -10) return '#ff9800';
    if (v >= -40) return '#f44336';
    return '#9c27b0';
  }

  protected findNpcById(ws: WorldState, id: string) {
    return ws.npcStates.find(n => n.npcId === id);
  }

  private triggerWorldStateUpdate(): void {
    const ws = this.worldStateService.state();
    if (!ws) return;
    const scenario = this.scenarioService.activeScenario();
    if (!scenario) return;
    const messages = this.chatService.messages();
    const lastExchanges = messages.slice(-6);
    if (lastExchanges.length === 0) return;

    this.aiAssist.updateWorldState({
      scenario: this.chatService.buildScenarioPayload(scenario),
      world_state: ws,
      last_exchanges: lastExchanges.map(m => ({
        role: m.role,
        content: m.content,
        input_type: m.inputType ?? 'dialogue',
      })),
    }).then(delta => {
      this.worldStateService.applyDelta(delta);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant') {
        const found = this.worldStateService.detectContradictions(lastMsg.content);
        if (found.length) this.contradictions.set(found);
      }
    }).catch(err => {
      console.warn('World state update failed (non-blocking)', err);
    });
  }

  async aiSuggestOrRewrite(): Promise<void> {
    if (this.aiAssisting() || this.chatService.loading()) return;
    this.aiAssisting.set(true);
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
      this.aiAssisting.set(false);
    }
  }
}
