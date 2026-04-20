import { Component, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
export class ChatComponent implements AfterViewChecked, OnInit {
  protected chatService = inject(ChatService);
  protected scenarioService = inject(ScenarioService);
  private aiAssist = inject(AiAssistService);
  private router = inject(Router);

  protected input = signal('');
  protected inputType = signal<InputType>('dialogue');
  protected showScenarioInfo = signal(false);
  protected aiAssisting = signal(false);

  @ViewChild('messageList') private messageList!: ElementRef<HTMLElement>;
  @ViewChild('chatInput') private chatInput!: ElementRef<HTMLTextAreaElement>;

  ngOnInit(): void {
    if (!this.scenarioService.activeScenario()) {
      this.router.navigate(['/scenario']);
    } else if (this.chatService.messages().length === 0) {
      this.chatService.initializeStory();
    }
  }

  ngAfterViewChecked(): void {
    const el = this.messageList?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  focusInput(): void {
    setTimeout(() => this.chatInput?.nativeElement?.focus(), 0);
  }

  toggleInputType(): void {
    this.inputType.update((t) => (t === 'dialogue' ? 'action' : 'dialogue'));
    this.focusInput();
  }

  toggleScenarioInfo(): void {
    this.showScenarioInfo.update((v) => !v);
  }

  resetStory(): void {
    if (this.chatService.messages().length === 0) return;
    if (!confirm('Reset the current story? The scenario will be kept but all messages will be cleared.')) return;
    this.chatService.resetMessages();
    this.chatService.initializeStory();
  }

  newScenario(): void {
    if (!confirm('Start a completely new scenario? This will clear everything.')) return;
    this.chatService.resetMessages();
    this.scenarioService.clearScenario();
    this.router.navigate(['/scenario']);
  }

  changeScenario(): void {
    if (this.chatService.messages().length > 0) {
      if (!confirm('Editing the scenario will reset the current story. Continue?')) return;
      this.chatService.resetMessages();
    }
    this.router.navigate(['/scenario']);
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

  async aiSuggestOrRewrite(): Promise<void> {
    if (this.aiAssisting() || this.chatService.loading()) return;
    this.aiAssisting.set(true);
    try {
      const currentText = this.input().trim();
      const messages = this.chatService.messages();
      const inputType = this.inputType();
      let result: string;
      if (currentText) {
        result = await this.aiAssist.rewriteInput(currentText, messages, inputType);
      } else {
        result = await this.aiAssist.suggestInput(messages, inputType);
      }
      this.input.set(result);
      this.focusInput();
    } catch (err) {
      console.error('AI assist error', err);
    } finally {
      this.aiAssisting.set(false);
    }
  }
}
