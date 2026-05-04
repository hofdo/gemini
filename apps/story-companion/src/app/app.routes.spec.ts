import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('includes root wizard route with loadComponent', () => {
    const route = appRoutes.find((r) => r.path === '');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });

  it('includes workspace route', () => {
    const route = appRoutes.find((r) => r.path === 'workspace/:id');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });

  it('includes wildcard redirect to the wizard', () => {
    const route = appRoutes.find((r) => r.path === '**');
    expect(route).toBeDefined();
    expect(route?.redirectTo).toBe('');
  });
});
