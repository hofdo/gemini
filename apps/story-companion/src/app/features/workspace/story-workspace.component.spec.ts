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
  beforeEach(() => {
    localStorage.clear();
  });

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
      providerMode: signal<'local' | 'openrouter'>('local'),
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

  it('keeps management actions hidden until the session tools panel is opened', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active_id: 'local', backends: [{ id: 'local', context_window: 8192 }] }),
      }),
    });

    const active = signal(makeStorySession());
    const service = {
      activeSession: active,
      loading: signal(false),
      error: signal<string | null>(null),
      providerMode: signal<'local' | 'openrouter'>('local'),
      setProviderMode: jest.fn(),
      loadSession: jest.fn().mockResolvedValue(active()),
      sendMessage: jest.fn(),
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
        { provide: ChatRenderingService, useValue: { render: (value: string) => value } },
        { provide: AdventureAssistService, useValue: { assist: jest.fn().mockResolvedValue('') } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StoryWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('Delete session');

    fixture.componentInstance.showSessionTools.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Delete session');
  });

  it('keeps context controls collapsed until the context panel is expanded', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active_id: 'local', backends: [{ id: 'local', context_window: 8192 }] }),
      }),
    });

    const active = signal(makeStorySession({
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: 'A'.repeat(5000),
          input_type: 'dialogue',
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    const service = {
      activeSession: active,
      loading: signal(false),
      error: signal<string | null>(null),
      providerMode: signal<'local' | 'openrouter'>('local'),
      setProviderMode: jest.fn(),
      loadSession: jest.fn().mockResolvedValue(active()),
      sendMessage: jest.fn(),
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
        { provide: ChatRenderingService, useValue: { render: (value: string) => value } },
        { provide: AdventureAssistService, useValue: { assist: jest.fn().mockResolvedValue('') } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StoryWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Context usage');
    expect(fixture.nativeElement.textContent).not.toContain('Trim context');

    fixture.componentInstance.showContextTools.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Trim context');
  });

  it('restores persisted composer state for the active session', async () => {
    localStorage.setItem('story-companion:workspace:session-1', JSON.stringify({
      draft: 'Recovered draft',
      inputMode: 'action',
    }));
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active_id: 'local', backends: [{ id: 'local', context_window: 8192 }] }),
      }),
    });

    const active = signal(makeStorySession({ id: 'session-1' }));
    const service = {
      activeSession: active,
      loading: signal(false),
      error: signal<string | null>(null),
      providerMode: signal<'local' | 'openrouter'>('local'),
      setProviderMode: jest.fn(),
      loadSession: jest.fn().mockResolvedValue(active()),
      sendMessage: jest.fn(),
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
        { provide: ChatRenderingService, useValue: { render: (value: string) => value } },
        { provide: AdventureAssistService, useValue: { assist: jest.fn().mockResolvedValue('') } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StoryWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.draft()).toBe('Recovered draft');
    expect(fixture.componentInstance.inputMode()).toBe('action');
  });

  it('persists composer changes and supports clear draft undo', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active_id: 'local', backends: [{ id: 'local', context_window: 8192 }] }),
      }),
    });

    const active = signal(makeStorySession({ id: 'session-1' }));
    const service = {
      activeSession: active,
      loading: signal(false),
      error: signal<string | null>(null),
      providerMode: signal<'local' | 'openrouter'>('local'),
      setProviderMode: jest.fn(),
      loadSession: jest.fn().mockResolvedValue(active()),
      sendMessage: jest.fn(),
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
        { provide: ChatRenderingService, useValue: { render: (value: string) => value } },
        { provide: AdventureAssistService, useValue: { assist: jest.fn().mockResolvedValue('') } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StoryWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.draft.set('Keep this line');
    fixture.componentInstance.inputMode.set('remember');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.clearDraft();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.draft()).toBe('');
    expect(fixture.componentInstance.lastClearedDraft()).toBe('Keep this line');
    expect(localStorage.getItem('story-companion:workspace:session-1')).toContain('"draft":""');

    fixture.componentInstance.undoClearDraft();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.draft()).toBe('Keep this line');
    expect(fixture.componentInstance.lastClearedDraft()).toBeNull();
    expect(localStorage.getItem('story-companion:workspace:session-1')).toContain('"inputMode":"remember"');
  });
});
