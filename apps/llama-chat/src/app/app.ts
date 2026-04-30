import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBoundaryComponent, AppErrorService } from '@nx-monorepo-experiment/shared-ui';

@Component({
  imports: [RouterOutlet, ErrorBoundaryComponent],
  selector: 'llama-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'llama-chat';
  private appErrorService = inject(AppErrorService);

  onRetry(): void {
    this.appErrorService.retry();
  }
}
