import { Component, inject, output } from '@angular/core';
import { AppErrorService } from './app-error.service';

@Component({
  selector: 'llama-error-boundary',
  standalone: true,
  template: `
    @if (!errorService.currentError()) {
      <ng-content />
    } @else {
      <div class="error-boundary">
        @switch (errorService.currentError()!.type) {
          @case ('llm_unreachable') {
            <h3>LLM unreachable</h3>
            <p>Could not connect to the language model. Make sure <code>npm run dev</code> is running.</p>
            <button (click)="onRetry()">Retry</button>
          }
          @case ('parse_failure') {
            <h3>Response parse error</h3>
            <p>{{ errorService.currentError()!.message }}</p>
            <button (click)="onRetry()">Retry</button>
          }
          @case ('quota_exceeded') {
            <h3>Context limit exceeded</h3>
            <p>The conversation is too long. Trim the context or start a new session.</p>
            <button (click)="onRetry()">Dismiss</button>
          }
          @case ('abort') {
            <h3>Generation aborted</h3>
            <button (click)="onRetry()">Dismiss</button>
          }
          @default {
            <h3>Something went wrong</h3>
            <p>{{ errorService.currentError()!.message }}</p>
            <button (click)="onRetry()">Retry</button>
          }
        }
      </div>
    }
  `,
  styles: [`
    .error-boundary {
      padding: 2rem;
      background: #1a0a0a;
      border: 1px solid #7f1d1d;
      border-radius: 8px;
      margin: 1rem;
      color: #fca5a5;
    }
    .error-boundary h3 { margin: 0 0 0.5rem 0; color: #f87171; }
    .error-boundary p { margin: 0 0 1rem 0; font-size: 0.9rem; opacity: 0.85; }
    .error-boundary code { background: rgba(255,255,255,0.1); padding: 0.1rem 0.3rem; border-radius: 3px; }
    .error-boundary button {
      padding: 0.4rem 1rem;
      background: #7f1d1d;
      color: #fef2f2;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .error-boundary button:hover { background: #991b1b; }
  `],
})
export class ErrorBoundaryComponent {
  protected errorService = inject(AppErrorService);

  // Fix 3A: emit retry so the parent can re-trigger the failed operation
  readonly retry = output<void>();

  onRetry(): void {
    this.errorService.clear();
    this.retry.emit();
  }
}
