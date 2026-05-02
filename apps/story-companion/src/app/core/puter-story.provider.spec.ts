import { TestBed } from '@angular/core/testing';

import { PuterStoryProvider, PUTER_GROK_MODEL } from './puter-story.provider';
import { PUTER_INSTANCE } from './puter-story.provider';

describe('PuterStoryProvider', () => {
  it('uses the hard-coded Grok model for scenario generation', async () => {
    const puter = {
      ai: {
        chat: jest.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              scenario_type: 'adventure',
              title: 'Ash Gate',
              setting: 'A burned city gate under black rain.',
              tone: 'tense',
              character_name: 'Mira',
              character_description: 'A watch captain with a broken oath.',
              npcs: [],
              rules: [],
            }),
          },
        }),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        PuterStoryProvider,
        { provide: PUTER_INSTANCE, useValue: puter },
      ],
    });
    const provider = TestBed.inject(PuterStoryProvider);

    const scenario = await provider.generateScenario({
      prompt: 'A burned city gate',
      scenarioType: 'adventure',
    });

    expect(scenario.title).toBe('Ash Gate');
    expect(provider.puter.ai.chat).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      model: PUTER_GROK_MODEL,
    }));
    const promptMessages = provider.puter.ai.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
    expect(promptMessages[0].content.toLowerCase()).toContain('adventure');
    expect(promptMessages[0].content.toLowerCase()).not.toContain('interpersonal');
    expect(promptMessages[0].content).not.toContain('partner_name');
  });
});
