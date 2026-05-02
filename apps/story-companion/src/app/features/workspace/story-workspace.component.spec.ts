import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';

import { StoryWorkspaceComponent } from './story-workspace.component';
import { StorySessionService } from '../../core/story-session.service';
import { ChatRenderingService } from '../../core/chat-rendering.service';
import { AdventureAssistService } from '../../core/adventure-assist.service';
import { makeStorySession } from '../../core/story-factories';

describe('StoryWorkspaceComponent', () => {
  it('send clears draft and does not send empty text', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active_id: 'local', backends: [{ id: 'local', context_window: 8192 }] }),
      }),
    });

    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const active = signal(makeStorySession());
    const service = {
      activeSession: active,
      loading: signal(false),
      error: signal<string | null>(null),
      setProviderMode: jest.fn(),
      loadSession: jest.fn().mockResolvedValue(active()),
      sendMessage,
      cancelGeneration: jest.fn(),
      regenerateLastResponse: jest.fn(),
      retryLastResponse: jest.fn(),
      resetCurrentStory: jest.fn(),
      deleteSession: jest.fn(),
      trimContext: jest.fn(),
      exportSessionToJson: jest.fn().mockReturnValue('{}'),
      exportAndReset: jest.fn(),
      generateOracle: jest.fn().mockResolvedValue({ oracle_type: 'npc_name', result: 'Mara', detail: '' }),
    };

    await TestBed.configureTestingModule({
      imports: [StoryWorkspaceComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: service,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'session-1',
              },
            },
          },
        },
        {
          provide: ChatRenderingService,
          useValue: { render: (value: string) => value },
        },
        {
          provide: AdventureAssistService,
          useValue: { assist: jest.fn().mockResolvedValue('') },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StoryWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.draft.set('   ');
    await fixture.componentInstance.send();
    expect(sendMessage).not.toHaveBeenCalled();

    fixture.componentInstance.draft.set('Open the gate');
    await fixture.componentInstance.send();
    expect(sendMessage).toHaveBeenCalledWith('Open the gate', 'dialogue');
    expect(fixture.componentInstance.draft()).toBe('');
  });

  it('exports session JSON on explicit user action', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active_id: 'local', backends: [{ id: 'local', context_window: 8192 }] }),
      }),
    });

    const exportSessionToJson = jest.fn().mockReturnValue('{"ok":true}');
    const active = signal(makeStorySession());
    const service = {
      activeSession: active,
      loading: signal(false),
      error: signal<string | null>(null),
      providerMode: signal<'local' | 'puter'>('local'),
      setProviderMode: jest.fn(),
      loadSession: jest.fn().mockResolvedValue(active()),
      sendMessage: jest.fn(),
      cancelGeneration: jest.fn(),
      regenerateLastResponse: jest.fn(),
      retryLastResponse: jest.fn(),
      resetCurrentStory: jest.fn(),
      deleteSession: jest.fn(),
      trimContext: jest.fn(),
      exportSessionToJson,
      exportAndReset: jest.fn(),
      generateOracle: jest.fn().mockResolvedValue({ oracle_type: 'npc_name', result: 'Mara', detail: '' }),
    };
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = jest.fn().mockReturnValue('blob:url');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL });

    await TestBed.configureTestingModule({
      imports: [StoryWorkspaceComponent],
      providers: [
        provideRouter([]),
        { provide: StorySessionService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'session-1',
              },
            },
          },
        },
        {
          provide: ChatRenderingService,
          useValue: { render: (value: string) => value },
        },
        {
          provide: AdventureAssistService,
          useValue: { assist: jest.fn().mockResolvedValue('') },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StoryWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.exportSession();
    expect(exportSessionToJson).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });
});
