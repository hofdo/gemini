import { Component, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { SettingsService } from '../shared/settings.service';

@Component({
  selector: 'llama-settings',
  standalone: true,
  imports: [NgClass],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private router = inject(Router);
  settings = inject(SettingsService);

  async ngOnInit(): Promise<void> {
    await this.settings.checkHealth();
    await this.settings.loadConfig();
  }

  async selectBackend(id: string): Promise<void> {
    await this.settings.setActiveBackend(id);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}

