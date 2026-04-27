import { Component, Input, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'llama-combat-log',
  standalone: true,
  template: `
    <div class="combat-log" #logContainer>
      <h3 class="log-header">Combat Log</h3>
      <ul class="log-list">
        @for (entry of log; track $index) {
          <li class="log-entry">{{ entry }}</li>
        }
        @if (!log.length) {
          <li class="log-empty">No actions yet.</li>
        }
      </ul>
    </div>
  `,
})
export class CombatLogComponent implements AfterViewChecked {
  @Input() log: string[] = [];
  @ViewChild('logContainer') private logContainer!: ElementRef<HTMLElement>;

  private _prevLength = 0;

  ngAfterViewChecked(): void {
    if (this.log.length !== this._prevLength) {
      this._prevLength = this.log.length;
      const el = this.logContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }
}
