import { TestBed } from '@angular/core/testing';
import { SettingsService, LlmBackend, BackendsConfig } from './settings.service';

const STORAGE_KEY = 'llm_active_backend_id';
const THINKING_KEY = 'llm_enable_thinking';
const TONE_KEY = 'llama-tone-settings';

function makeBackend(id: string, overrides: Partial<LlmBackend> = {}): LlmBackend {
  return {
    id,
    name: `Backend ${id}`,
    url: 'http://localhost:8080',
    model: 'test-model',
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    ...overrides,
  };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let store: Record<string, string>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    store = {};

    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => store[key] ?? null);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      store[key] = value;
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete store[key];
    });

    fetchMock = jest.fn();
    global.fetch = fetchMock;

    TestBed.configureTestingModule({ providers: [SettingsService] });
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise with empty backends list', () => {
    expect(service.backends()).toEqual([]);
  });

  it('should initialise enableThinking from localStorage', () => {
    store[THINKING_KEY] = 'true';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [SettingsService] });
    service = TestBed.inject(SettingsService);
    expect(service.enableThinking()).toBe(true);
  });

  it('enableThinking should default to false when not stored', () => {
    expect(service.enableThinking()).toBe(false);
  });

  it('setEnableThinking should update signal and persist to localStorage', () => {
    service.setEnableThinking(true);
    expect(service.enableThinking()).toBe(true);
    expect(store[THINKING_KEY]).toBe('true');
  });

  describe('loadConfig', () => {
    const backends = [makeBackend('alpha'), makeBackend('beta', { context_window: 4096 })];
    const config: BackendsConfig = { backends, active_id: 'alpha' };

    it('should populate backends signal on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => config,
      });

      await service.loadConfig();

      expect(service.backends()).toEqual(backends);
    });

    it('should set proxyReachable to true on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => config,
      });

      await service.loadConfig();

      expect(service.proxyReachable()).toBe(true);
    });

    it('should use proxy active_id when nothing is stored in localStorage', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => config,
      });

      await service.loadConfig();

      expect(service.activeId()).toBe('alpha');
    });

    it('should prefer savedId from localStorage when it is a valid backend', async () => {
      store[STORAGE_KEY] = 'beta';
      // Second fetch is the PATCH to sync with proxy
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => config })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await service.loadConfig();

      expect(service.activeId()).toBe('beta');
    });

    it('should fall back to proxy active_id when stored id is not in backends list', async () => {
      store[STORAGE_KEY] = 'nonexistent';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => config,
      });

      await service.loadConfig();

      expect(service.activeId()).toBe('alpha');
    });

    it('should update contextWindow from the active backend', async () => {
      const backendsWithWindow = [makeBackend('beta', { context_window: 4096 })];
      const cfg: BackendsConfig = { backends: backendsWithWindow, active_id: 'beta' };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => cfg });

      await service.loadConfig();

      expect(service.contextWindow()).toBe(4096);
    });

    it('should set proxyReachable to false on fetch failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await service.loadConfig();

      expect(service.proxyReachable()).toBe(false);
    });

    it('should set loading to false after completion (success)', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => config });

      await service.loadConfig();

      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after completion (failure)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));

      await service.loadConfig();

      expect(service.loading()).toBe(false);
    });
  });

  describe('setActiveBackend', () => {
    beforeEach(async () => {
      const config: BackendsConfig = {
        backends: [makeBackend('alpha'), makeBackend('beta', { context_window: 2048 })],
        active_id: 'alpha',
      };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => config });
      await service.loadConfig();
    });

    it('should update activeId and persist to localStorage on success', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await service.setActiveBackend('beta');

      expect(service.activeId()).toBe('beta');
      expect(store[STORAGE_KEY]).toBe('beta');
    });

    it('should update contextWindow when backend has context_window', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await service.setActiveBackend('beta');

      expect(service.contextWindow()).toBe(2048);
    });

    it('should set patchError on failure', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

      await service.setActiveBackend('beta');

      expect(service.patchError()).toBeTruthy();
    });
  });

  describe('updateTone', () => {
    it('should merge patch into current tone settings', () => {
      service.updateTone({ pacing: 'cinematic' });
      expect(service.toneSettings().pacing).toBe('cinematic');
      expect(service.toneSettings().register).toBe('balanced'); // unchanged
    });

    it('should persist tone settings to localStorage', () => {
      service.updateTone({ boundary: 'unfiltered' });
      const stored = JSON.parse(store[TONE_KEY]);
      expect(stored.boundary).toBe('unfiltered');
    });
  });

  describe('activeBackend', () => {
    it('should return the currently active backend object', async () => {
      const backends = [makeBackend('alpha'), makeBackend('beta')];
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ backends, active_id: 'alpha' }) });
      await service.loadConfig();

      expect(service.activeBackend()).toEqual(backends[0]);
    });

    it('should return undefined when no backends are loaded', () => {
      expect(service.activeBackend()).toBeUndefined();
    });
  });
});
