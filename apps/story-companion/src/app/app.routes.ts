import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./features/wizard/scenario-wizard.component').then((m) => m.ScenarioWizardComponent),
  },
  {
    path: 'workspace/:id',
    loadComponent: () =>
      import('./features/workspace/story-workspace.component').then((m) => m.StoryWorkspaceComponent),
  },
  {
    path: 'workspace/:id/dm',
    loadComponent: () => import('./features/dm/dm.component').then((m) => m.DmComponent),
  },
  {
    path: 'workspace/:id/journal',
    loadComponent: () => import('./features/journal/journal.component').then((m) => m.JournalComponent),
  },
  {
    path: 'workspace/:id/combat',
    loadComponent: () => import('./features/combat/combat.component').then((m) => m.CombatComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
