import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

const QUICK_ACTIONS = ['Attack', 'Dodge', 'Flee', 'Cast Spell'] as const;

@Component({
  selector: 'llama-action-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="action-panel">
      <div class="quick-actions">
        @for (qa of quickActions; track qa) {
          <button class="btn-quick"
                  [disabled]="loading"
                  (click)="emitAction(qa)">
            {{ qa }}
          </button>
        }
      </div>
      <div class="action-input-row">
        <input
          class="action-input"
          type="text"
          placeholder="Describe your action…"
          [disabled]="loading"
          [(ngModel)]="inputText"
          (keydown.enter)="submitText()"
        />
        <button class="btn-submit"
                [disabled]="loading || !inputText.trim()"
                (click)="submitText()">
          @if (loading) { ⏳ } @else { Submit }
        </button>
      </div>
    </div>
  `,
})
export class ActionPanelComponent {
  @Input() loading = false;
  @Output() action = new EventEmitter<string>();

  readonly quickActions = QUICK_ACTIONS;
  inputText = '';

  emitAction(text: string): void {
    if (this.loading) return;
    this.action.emit(text);
  }

  submitText(): void {
    const text = this.inputText.trim();
    if (!text || this.loading) return;
    this.action.emit(text);
    this.inputText = '';
  }
}
