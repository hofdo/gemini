import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WorldStateService } from '@nx-monorepo-experiment/shared-world-state';

@Component({
  selector: 'llama-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
  private router = inject(Router);
  readonly worldStateService = inject(WorldStateService);

  selectMode(mode: string): void {
    if (mode === 'dm') {
      this.router.navigate(['/dm']);
    } else {
      this.router.navigate(['/scenario', mode]);
    }
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  goToJournal(): void {
    this.router.navigate(['/journal']);
  }
}

