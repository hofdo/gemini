import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBoundaryComponent } from './shared/error-boundary.component';

@Component({
  imports: [RouterOutlet, ErrorBoundaryComponent],
  selector: 'llama-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'llama-chat';
}
