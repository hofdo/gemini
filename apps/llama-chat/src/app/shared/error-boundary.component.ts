import { Component, signal } from '@angular/core';

@Component({
  selector: 'error-boundary',
  standalone: true,
  template: `
  @if (!error()) {
    <ng-content />
  } @else {
    <div class="error-boundary">
      <h3>Something went wrong</h3>
      <p>{{ error()?.message }}</p>
      <button (click)="reset()">Try again</button>
    </div>
  }
`,
  styles: [
    `
      .error-boundary {
        padding: 2rem;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 8px;
        margin: 1rem 0;
      }
      .error-boundary h3 {
        color: #c33;
        margin: 0 0 0.5rem 0;
      }
      .error-boundary button {
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: #c33;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `,
  ],
})
export class ErrorBoundaryComponent {
  error = signal<Error | null>(null);

  handleError(err: Error): void {
    this.error.set(err);
  }

  reset(): void {
    this.error.set(null);
  }
}
