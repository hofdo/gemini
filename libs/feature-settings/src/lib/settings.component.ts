import { Component, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { SettingsService } from '@nx-monorepo-experiment/shared-settings';

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
  // Alias for template consistency with Phase 3c HTML spec
  protected settingsService = this.settings;

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

  // Phase 3c: Tone proxy for template
  updateTone(patch: Parameters<SettingsService['updateTone']>[0]): void {
    this.settings.updateTone(patch);
  }
}

