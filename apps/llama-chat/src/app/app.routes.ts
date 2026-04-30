import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-menu').then((m) => m.MenuComponent),
  },
  {
    path: 'scenario/:mode',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-scenario').then((m) => m.ScenarioFormComponent),
  },
  {
    path: 'dm',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-dm').then((m) => m.DmComponent),
  },
  {
    path: 'dm/session-zero',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-dm').then((m) => m.SessionZeroComponent),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-chat').then((m) => m.ChatComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-settings').then((m) => m.SettingsComponent),
  },
  {
    path: 'journal',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-journal').then((m) => m.JournalComponent),
  },
  {
    path: 'combat',
    loadComponent: () =>
      import('@nx-monorepo-experiment/feature-combat').then((m) => m.CombatComponent),
  },
  { path: '**', redirectTo: '' },
];

