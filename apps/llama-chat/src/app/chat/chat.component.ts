import { Component, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from './chat.service';
import { ScenarioService } from '../scenario/scenario.service';
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
  private router = inject(Router);

  protected input = signal('');
  protected inputType = signal<InputType>('dialogue');
  protected showScenarioInfo = signal(false);

  @ViewChild('messageList') private messageList!: ElementRef<HTMLElement>;
  @ViewChild('chatInput') private chatInput!: ElementRef<HTMLTextAreaElement>;

  ngOnInit(): void {
    if (!this.scenarioService.activeScenario()) {
      this.router.navigate(['/scenario']);
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
    this.focusInput();
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
}
