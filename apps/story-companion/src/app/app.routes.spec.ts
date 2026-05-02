import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('includes workspace route', () => {
    expect(appRoutes.some((r) => r.path === 'workspace/:id')).toBe(true);
  });

  it('includes dm route with loadComponent', () => {
    const route = appRoutes.find((r) => r.path === 'workspace/:id/dm');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });

  it('includes journal route with loadComponent', () => {
    const route = appRoutes.find((r) => r.path === 'workspace/:id/journal');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });

  it('includes combat route with loadComponent', () => {
    const route = appRoutes.find((r) => r.path === 'workspace/:id/combat');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });
});
