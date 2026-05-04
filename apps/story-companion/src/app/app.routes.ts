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
    path: '**',
    redirectTo: '',
  },
];
