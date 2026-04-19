import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'scenario', pathMatch: 'full' },
  {
    path: 'scenario',
    loadComponent: () =>
      import('./scenario/scenario-form/scenario-form.component').then((m) => m.ScenarioFormComponent),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./chat/chat.component').then((m) => m.ChatComponent),
  },
];

