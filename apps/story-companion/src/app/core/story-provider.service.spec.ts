import { TestBed } from '@angular/core/testing';

import { makeStorySession } from './story-factories';
import { LocalStoryProvider } from './local-story.provider';
import { PuterStoryProvider } from './puter-story.provider';
import { StoryProviderService } from './story-provider.service';

describe('StoryProviderService', () => {
  it('uses the local provider for local mode', async () => {
    const local = {
      generateScenario: jest.fn(),
      streamChat: jest.fn(async function* () {
        yield 'local';
      }),
      extractWorldDelta: jest.fn(),
      summarizeSession: jest.fn(),
      generateOracle: jest.fn(),
      cancelGeneration: jest.fn(),
    };
    const puter = {
      generateScenario: jest.fn(),
      streamChat: jest.fn(async function* () {
        yield 'puter';
      }),
      extractWorldDelta: jest.fn(),
      summarizeSession: jest.fn(),
      generateOracle: jest.fn(),
      cancelGeneration: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        StoryProviderService,
        { provide: LocalStoryProvider, useValue: local },
        { provide: PuterStoryProvider, useValue: puter },
      ],
    });

    const service = TestBed.inject(StoryProviderService);
    const tokens = [];
    for await (const token of service.forMode('local').streamChat({
      session: makeStorySession({ providerMode: 'local' }),
      messages: [],
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['local']);
    expect(local.streamChat).toHaveBeenCalled();
    expect(puter.streamChat).not.toHaveBeenCalled();
  });

  it('uses the Puter provider for puter mode', async () => {
    const local = {
      generateScenario: jest.fn(),
      streamChat: jest.fn(),
      extractWorldDelta: jest.fn(),
      summarizeSession: jest.fn(),
      generateOracle: jest.fn(),
      cancelGeneration: jest.fn(),
    };
    const puter = {
      generateScenario: jest.fn(),
      streamChat: jest.fn(async function* () {
        yield 'grok';
      }),
      extractWorldDelta: jest.fn(),
      summarizeSession: jest.fn(),
      generateOracle: jest.fn(),
      cancelGeneration: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        StoryProviderService,
        { provide: LocalStoryProvider, useValue: local },
        { provide: PuterStoryProvider, useValue: puter },
      ],
    });

    const service = TestBed.inject(StoryProviderService);
    const tokens = [];
    for await (const token of service.forMode('puter').streamChat({
      session: makeStorySession({ providerMode: 'puter' }),
      messages: [],
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['grok']);
    expect(puter.streamChat).toHaveBeenCalled();
    expect(local.streamChat).not.toHaveBeenCalled();
  });
});
