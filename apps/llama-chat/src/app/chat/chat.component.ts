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

  @ViewChild('messageList') private messageList!: ElementRef<HTMLElement>;

  ngOnInit(): void {
    if (!this.scenarioService.activeScenario()) {
      this.router.navigate(['/scenario']);
    }
  }

  ngAfterViewChecked(): void {
    const el = this.messageList?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  toggleInputType(): void {
    this.inputType.update((t) => (t === 'dialogue' ? 'action' : 'dialogue'));
  }

  changeScenario(): void {
    if (this.chatService.messages().length > 0) {
      if (!confirm('Changing the scenario will reset the current story. Continue?')) return;
      this.chatService.resetMessages();
    }
    this.router.navigate(['/scenario']);
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.chatService.loading()) return;
    this.input.set('');
    this.chatService.sendMessage(text, this.inputType());
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}

