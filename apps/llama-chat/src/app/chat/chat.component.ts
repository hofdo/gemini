import { Component, computed, effect, inject, signal, ViewChild, ElementRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SecurityContext } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { marked } from 'marked';
import { ChatService } from './chat.service';
import { ScenarioService } from '../scenario/scenario.service';
import { AiAssistService } from '../shared/ai-assist.service';
import { InputType } from '../scenario/scenario.model';

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
  private aiAssist = inject(AiAssistService);
  private router = inject(Router);
  private readonly _sanitizer = inject(DomSanitizer);

  protected input = signal('');
  protected inputType = signal<InputType>('dialogue');
  protected showScenarioInfo = signal(false);
  protected aiAssisting = signal(false);
  protected pendingAction = signal<'reset' | 'new' | 'change' | 'trim' | null>(null);

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

  ngOnInit(): void {
    if (!this.scenarioService.activeScenario()) {
      this.router.navigate(['/']);
    } else {
      this.chatService.loadPersistedMessages();
      if (this.chatService.messages().length === 0) {
        this.chatService.initializeStory();
      }
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
