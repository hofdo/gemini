import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ChatService } from './chat.service';
import { ScenarioService } from '../scenario/scenario.service';
import { SettingsService } from '../shared/settings.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChatService,
        {
          provide: ScenarioService,
          useValue: { activeScenario: signal(null) },
        },
        {
          provide: SettingsService,
          useValue: { enableThinking: signal(false), contextWindow: signal(8192) },
        },
      ],
    });

    service = TestBed.inject(ChatService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should reset messages', () => {
    service['messages'].set([
      { role: 'user', content: 'test' },
      { role: 'assistant', content: 'response' },
    ]);

    service.resetMessages();

    expect(service.messages().length).toBe(0);
  });

  it('should trim context when token limit exceeded', () => {
    const mockMessages = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i} with some content to increase token count`,
    }));

    service['messages'].set(mockMessages);
    service.trimContext(5);

    expect(service.messages().length).toBe(5);
  });

  it('should not trim context when under limit', () => {
    const mockMessages = [
      { role: 'user' as const, content: 'Message 1' },
      { role: 'assistant' as const, content: 'Response 1' },
    ];

    service['messages'].set(mockMessages);
    service.trimContext(5);

    expect(service.messages().length).toBe(2);
  });

  it('should estimate tokens correctly', () => {
    service['messages'].set([
      { role: 'user', content: 'This is a test message with some content' },
      { role: 'assistant', content: 'This is a response' },
    ]);

    const estimatedTokens = service.estimatedTokens();
    expect(estimatedTokens).toBeGreaterThan(0);
  });

  it('should show context warning when tokens exceed threshold', () => {
    // contextWindow=8192, warning at 50% = 4096 tokens = 16384 chars
    const longContent = 'x'.repeat(17000); // 4250 tokens > 4096 threshold
    service['messages'].set([{ role: 'user', content: longContent }]);

    expect(service.contextWarning()).toBe(true);
  });

  it('should show context critical when tokens exceed critical threshold', () => {
    // contextWindow=8192, critical at 75% = 6144 tokens = 24576 chars
    const longContent = 'x'.repeat(25600); // 6400 tokens > 6144 threshold
    service['messages'].set([{ role: 'user', content: longContent }]);

    expect(service.contextCritical()).toBe(true);
  });

  it('should cancel stream', () => {
    service.cancelStream();
    expect(service['_abortController']).toBeNull();
  });
});
