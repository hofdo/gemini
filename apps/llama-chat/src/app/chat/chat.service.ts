import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);

  sendMessage(content: string): void {
    const userMsg: ChatMessage = { role: 'user', content };
    this.messages.update((msgs) => [...msgs, userMsg]);
    this.loading.set(true);

    this.http
      .post<ChatResponse>('/chat', { messages: this.messages() })
      .subscribe({
        next: (res) => {
          this.messages.update((msgs) => [
            ...msgs,
            { role: 'assistant', content: res.reply },
          ]);
        },
        error: (err) => {
          console.error('Chat error', err);
          this.messages.update((msgs) => [
            ...msgs,
            { role: 'assistant', content: '⚠️ Error reaching the backend.' },
          ]);
        },
        complete: () => this.loading.set(false),
      });
  }
}

