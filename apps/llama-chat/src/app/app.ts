import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBoundaryComponent } from './shared/error-boundary.component';
import { ChatService } from './chat/chat.service';

@Component({
  imports: [RouterOutlet, ErrorBoundaryComponent],
  selector: 'llama-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'llama-chat';
  // Fix 3A: retry last chat stream when error boundary fires retry
  private chatService = inject(ChatService);

  onRetry(): void {
    this.chatService.retryLastStream();
  }
}
