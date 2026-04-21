import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'llama-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
  constructor(private router: Router) {}

  selectMode(mode: string): void {
    if (mode === 'dm') {
      this.router.navigate(['/dm']);
    } else {
      this.router.navigate(['/scenario', mode]);
    }
  }
}

