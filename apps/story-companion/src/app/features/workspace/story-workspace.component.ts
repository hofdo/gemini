import { Component, computed, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChatRenderingService } from '../../core/chat-rendering.service';
import { AdventureAssistService } from '../../core/adventure-assist.service';
import { StorySessionService } from '../../core/story-session.service';
import type { InputMode, ProviderMode } from '../../core/story-types';
import { WorldPanelComponent } from '../world-panel/world-panel.component';

@Component({
  selector: 'story-workspace',
  imports: [FormsModule, RouterLink, WorldPanelComponent],
  templateUrl: './story-workspace.component.html',
  styleUrl: './story-workspace.component.scss',
})
export class StoryWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly story = inject(StorySessionService);
  private readonly renderer = inject(ChatRenderingService);
  private readonly assist = inject(AdventureAssistService);

  readonly draft = signal('');
  readonly inputMode = signal<InputMode>('dialogue');
  readonly assistLoading = signal(false);
  readonly confirmation = signal<'reset' | 'new' | 'change' | 'delete' | null>(null);
  readonly keepLastCount = signal(20);
  readonly oracleResults = signal<Array<{ oracle_type: string; result: string; detail: string }>>([]);
  readonly showWorldPanel = signal(true);
  readonly contradictionDismissed = signal(false);
  readonly session = this.story.activeSession;
  readonly loading = this.story.loading;
  readonly error = this.story.error;

  readonly messages = computed(() => this.session()?.messages ?? []);
  readonly worldState = computed(() => this.session()?.worldState ?? null);
  readonly tokenEstimate = computed(() => Math.ceil(this.messages().reduce((total, item) => total + item.content.length, 0) / 4));
  readonly contextWindow = signal(8192);
  readonly contextUsagePercent = computed(() => Math.round((this.tokenEstimate() / this.contextWindow()) * 100));
  readonly contextWarning = computed(() => this.contextUsagePercent() >= 50);
  readonly contextCritical = computed(() => this.contextUsagePercent() >= 75);
  readonly contradictionWarning = computed(() => {
    if (this.contradictionDismissed()) return null;
    const facts = (this.worldState()?.keyFacts ?? []).map((value) => value.toLowerCase());
    const contradictory = facts.find((fact) => fact.includes(' not ') && facts.some((other) => other !== fact && other.replace(' not ', ' ').includes(fact.replace(' not ', ' '))));
    return contradictory ? 'Potential contradiction detected in key facts.' : null;
  });

  @ViewChild('messageList') private readonly messageListRef?: ElementRef<HTMLDivElement>;
  @ViewChild('composerInput') private readonly composerRef?: ElementRef<HTMLTextAreaElement>;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.story.loadSession(id).then(() => this.refreshContextWindow());
    }

    effect(() => {
      this.messages();
      this.loading();
      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  toggleWorldPanel(): void {
    this.showWorldPanel.set(!this.showWorldPanel());
  }

  dismissContradiction(): void {
    this.contradictionDismissed.set(true);
  }

  async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text) return;
    this.draft.set('');
    await this.story.sendMessage(text, this.inputMode());
  }

  setProvider(mode: ProviderMode): void {
    void this.story.setProviderMode(mode).then(() => this.refreshContextWindow());
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  renderAssistantMessage(content: string): string {
    return this.renderer.render(content);
  }

  stop(): void {
    this.story.cancelGeneration();
  }

  async regenerate(): Promise<void> {
    await this.story.regenerateLastResponse();
  }

  async retry(): Promise<void> {
    await this.story.retryLastResponse();
  }

  requestConfirmation(action: 'reset' | 'new' | 'change' | 'delete'): void {
    this.confirmation.set(action);
  }

  clearConfirmation(): void {
    this.confirmation.set(null);
  }

  async confirmAction(): Promise<void> {
    const session = this.session();
    const action = this.confirmation();
    if (!action || !session) return;

    this.confirmation.set(null);
    if (action === 'reset') {
      await this.story.resetCurrentStory();
      return;
    }
    if (action === 'delete') {
      await this.story.deleteSession(session.id);
      await this.router.navigate(['/']);
      return;
    }
    if (action === 'change') {
      await this.router.navigate(['/'], { queryParams: { edit: session.id } });
      return;
    }
    if (action === 'new') {
      await this.router.navigate(['/']);
    }
  }

  async trimContext(): Promise<void> {
    await this.story.trimContext(this.keepLastCount());
  }

  exportSession(): void {
    const content = this.story.exportSessionToJson();
    if (!content) return;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `story-session-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async exportAndReset(): Promise<void> {
    this.exportSession();
    await this.story.resetCurrentStory();
  }

  async assistInput(): Promise<void> {
    const session = this.session();
    if (!session || this.assistLoading() || this.loading()) return;
    this.assistLoading.set(true);
    try {
      const hasDraft = this.draft().trim().length > 0;
      const text = await this.assist.assist({
        mode: hasDraft ? 'rewrite' : 'suggest',
        currentText: this.draft(),
        inputType: this.inputMode(),
        scenario: session.scenario,
        messages: session.messages,
      });
      this.draft.set(text);
      this.focusComposer();
    } finally {
      this.assistLoading.set(false);
    }
  }

  async generateOracle(type: 'npc_name' | 'location_name' | 'quest_hook'): Promise<void> {
    const result = await this.story.generateOracle(type);
    this.oracleResults.set([result, ...this.oracleResults()].slice(0, 8));
  }

  private scrollToBottom(): void {
    const node = this.messageListRef?.nativeElement;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }

  private focusComposer(): void {
    this.composerRef?.nativeElement.focus();
  }

  private async refreshContextWindow(): Promise<void> {
    const mode = this.session()?.providerMode ?? this.story.providerMode();
    if (mode !== 'local') {
      this.contextWindow.set(8192);
      return;
    }
    try {
      const response = await fetch('/config/backends');
      if (!response.ok) return;
      const data = (await response.json()) as {
        active_id?: string;
        backends?: Array<{ id: string; context_window?: number }>;
      };
      const contextWindow = data.backends?.find((backend) => backend.id === data.active_id)?.context_window;
      this.contextWindow.set(contextWindow && contextWindow > 0 ? contextWindow : 8192);
    } catch {
      this.contextWindow.set(8192);
    }
  }
}
