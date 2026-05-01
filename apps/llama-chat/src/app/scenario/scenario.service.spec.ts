import { TestBed } from '@angular/core/testing';
import { ScenarioService } from './scenario.service';
import { Scenario } from './scenario.model';

const STORAGE_KEY = 'llama-scenario';

const minimalScenario: Scenario = {
  scenarioType: 'adventure',
  title: 'Test Quest',
  setting: 'A dark forest',
  tone: 'gritty',
  characterName: 'Hero',
  characterDescription: 'A brave warrior',
  npcs: [],
  rules: [],
};

describe('ScenarioService', () => {
  let service: ScenarioService;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};

    // Stub localStorage
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => store[key] ?? null);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      store[key] = value;
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete store[key];
    });

    TestBed.configureTestingModule({ providers: [ScenarioService] });
    service = TestBed.inject(ScenarioService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise activeScenario as null when localStorage is empty', () => {
    expect(service.activeScenario()).toBeNull();
  });

  it('should load a saved scenario from localStorage on construction', () => {
    store[STORAGE_KEY] = JSON.stringify(minimalScenario);
    // Re-create service so constructor re-runs with pre-populated store
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ScenarioService] });
    service = TestBed.inject(ScenarioService);

    expect(service.activeScenario()).toEqual(minimalScenario);
  });

  it('setScenario should update the signal', () => {
    service.setScenario(minimalScenario);
    expect(service.activeScenario()).toEqual(minimalScenario);
  });

  it('setScenario should persist to localStorage', () => {
    service.setScenario(minimalScenario);
    expect(store[STORAGE_KEY]).toBe(JSON.stringify(minimalScenario));
  });

  it('clearScenario should set signal to null', () => {
    service.setScenario(minimalScenario);
    service.clearScenario();
    expect(service.activeScenario()).toBeNull();
  });

  it('clearScenario should remove item from localStorage', () => {
    service.setScenario(minimalScenario);
    service.clearScenario();
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  it('should return null when localStorage contains invalid JSON', () => {
    store[STORAGE_KEY] = 'not-valid-json';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ScenarioService] });
    service = TestBed.inject(ScenarioService);

    expect(service.activeScenario()).toBeNull();
  });
});
