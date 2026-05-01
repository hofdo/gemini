import { TestBed } from '@angular/core/testing';
import { PresetScenarioService, PresetMeta } from './preset-scenario.service';

const sampleMeta: PresetMeta = { id: 'dragon-hunt', label: 'Dragon Hunt', type: 'adventure' };

describe('PresetScenarioService', () => {
  let service: PresetScenarioService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    TestBed.configureTestingModule({ providers: [PresetScenarioService] });
    service = TestBed.inject(PresetScenarioService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadIndex', () => {
    it('should GET /scenarios/index.json and return the list', async () => {
      const index: PresetMeta[] = [sampleMeta];
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => index });

      const result = await service.loadIndex();

      expect(fetchMock.mock.calls[0][0]).toBe('/scenarios/index.json');
      expect(result).toEqual(index);
    });

    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(service.loadIndex()).rejects.toThrow('HTTP 404');
    });
  });

  describe('loadScenario', () => {
    it('should GET the correct URL based on meta type and id', async () => {
      const scenario = { scenarioType: 'adventure', title: 'Dragon Hunt', npcs: [] };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => scenario });

      const result = await service.loadScenario(sampleMeta);

      expect(fetchMock.mock.calls[0][0]).toBe('/scenarios/adventure/dragon-hunt.json');
      expect(result).toEqual(scenario);
    });

    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(service.loadScenario(sampleMeta)).rejects.toThrow('HTTP 404');
    });
  });
});
