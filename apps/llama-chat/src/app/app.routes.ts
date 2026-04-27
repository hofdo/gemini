import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./menu/menu.component').then((m) => m.MenuComponent),
  },
  {
    path: 'scenario/:mode',
    loadComponent: () =>
      import('./scenario/scenario-form/scenario-form.component').then((m) => m.ScenarioFormComponent),
  },
  {
    path: 'dm',
    loadComponent: () =>
      import('./dm/dm.component').then((m) => m.DmComponent),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./chat/chat.component').then((m) => m.ChatComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'journal',
    loadComponent: () =>
      import('./journal/journal.component').then((m) => m.JournalComponent),
  },
  {
    path: 'combat',
    loadComponent: () =>
      import('./combat/combat.component').then((m) => m.CombatComponent),
  },
  { path: '**', redirectTo: '' },
];

