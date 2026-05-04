import { TestBed } from '@angular/core/testing';

import { makeStorySession } from './story-factories';
import { LocalStoryProvider } from './local-story.provider';
import { OpenRouterStoryProvider } from './openrouter-story.provider';
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
    const openrouter = {
      generateScenario: jest.fn(),
      streamChat: jest.fn(async function* () {
        yield 'openrouter';
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
        { provide: OpenRouterStoryProvider, useValue: openrouter },
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
    expect(openrouter.streamChat).not.toHaveBeenCalled();
  });

  it('uses the OpenRouter provider for openrouter mode', async () => {
    const local = {
      generateScenario: jest.fn(),
      streamChat: jest.fn(),
      extractWorldDelta: jest.fn(),
      summarizeSession: jest.fn(),
      generateOracle: jest.fn(),
      cancelGeneration: jest.fn(),
    };
    const openrouter = {
      generateScenario: jest.fn(),
      streamChat: jest.fn(async function* () {
        yield 'cloud';
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
        { provide: OpenRouterStoryProvider, useValue: openrouter },
      ],
    });

    const service = TestBed.inject(StoryProviderService);
    const tokens = [];
    for await (const token of service.forMode('openrouter').streamChat({
      session: makeStorySession({ providerMode: 'openrouter' }),
      messages: [],
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['cloud']);
    expect(openrouter.streamChat).toHaveBeenCalled();
    expect(local.streamChat).not.toHaveBeenCalled();
  });
});
