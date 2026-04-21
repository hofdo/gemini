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
  { path: '**', redirectTo: '' },
];

