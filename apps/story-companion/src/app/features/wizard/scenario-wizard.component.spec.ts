import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { ScenarioWizardComponent } from './scenario-wizard.component';
import { StorySessionService } from '../../core/story-session.service';
import { PresetScenarioService } from '../../core/preset-scenario.service';

describe('ScenarioWizardComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not expose interpersonal scenario generation and requests adventure scenarios', async () => {
    const generateScenario = jest.fn().mockResolvedValue({
      scenario_type: 'adventure',
      title: 'Ash Gate',
      setting: 'A burned city gate under black rain.',
      tone: 'tense',
      character_name: 'Mira',
      character_description: 'A watch captain with a broken oath.',
      npcs: [],
      rules: [],
    });

    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario,
            createSession: jest.fn(),
            updateSessionScenario: jest.fn(),
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('Interpersonal');

    await fixture.componentInstance.generate();
    expect(generateScenario).toHaveBeenCalledWith(expect.any(String), 'adventure');
  });

  it('keeps Start workspace disabled when required scenario fields are empty', async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario: jest.fn(),
            createSession: jest.fn(),
            updateSessionScenario: jest.fn(),
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    jest.spyOn((fixture.componentInstance as { router: Router }).router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.generatedScenario.set({
      scenario_type: 'adventure',
      title: '',
      setting: '',
      tone: '',
      character_name: '',
      character_description: '',
      npcs: [],
      rules: [],
    });
    fixture.componentInstance.editorValid.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    const startButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent?.includes('Start workspace'));

    expect(startButton).toBeTruthy();
    expect(startButton?.disabled).toBe(true);
  });

  it('applies edited scenario to current session when save into current session is chosen', async () => {
    const updateSessionScenario = jest.fn().mockResolvedValue({ id: 'session-1' });
    const createSession = jest.fn();
    const loadSession = jest.fn().mockResolvedValue({
      id: 'session-1',
      scenario: {
        scenario_type: 'adventure',
        title: 'Old',
        setting: 'Old',
        tone: 'Old',
        character_name: 'Old',
        character_description: 'Old',
        npcs: [],
        rules: [],
      },
    });
    jest.spyOn(window, 'prompt').mockReturnValue('reset');

    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario: jest.fn(),
            createSession,
            updateSessionScenario,
            loadSession,
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => 'session-1',
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.generatedScenario.set({
      scenario_type: 'adventure',
      title: 'New',
      setting: 'New',
      tone: 'New',
      character_name: 'New',
      character_description: 'New',
      npcs: [],
      rules: [],
    });
    fixture.componentInstance.scenarioJson.set(JSON.stringify(fixture.componentInstance.generatedScenario(), null, 2));
    fixture.componentInstance.editorValid.set(true);
    fixture.componentInstance.saveMode.set('current');

    await fixture.componentInstance.confirm();
    expect(updateSessionScenario).toHaveBeenCalledWith('session-1', expect.objectContaining({ title: 'New' }), true);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('creates a new session from edit flow when save as new is chosen', async () => {
    const updateSessionScenario = jest.fn();
    const createSession = jest.fn().mockResolvedValue({ id: 'session-new' });
    const loadSession = jest.fn().mockResolvedValue({
      id: 'session-1',
      scenario: {
        scenario_type: 'adventure',
        title: 'Old',
        setting: 'Old',
        tone: 'Old',
        character_name: 'Old',
        character_description: 'Old',
        npcs: [],
        rules: [],
      },
    });
    jest.spyOn(window, 'prompt').mockReturnValue('new');

    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario: jest.fn(),
            createSession,
            updateSessionScenario,
            loadSession,
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => 'session-1',
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    jest.spyOn((fixture.componentInstance as { router: Router }).router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.generatedScenario.set({
      scenario_type: 'adventure',
      title: 'New',
      setting: 'New',
      tone: 'New',
      character_name: 'New',
      character_description: 'New',
      npcs: [],
      rules: [],
    });
    fixture.componentInstance.scenarioJson.set(JSON.stringify(fixture.componentInstance.generatedScenario(), null, 2));
    fixture.componentInstance.editorValid.set(true);
    fixture.componentInstance.saveMode.set('new');

    await fixture.componentInstance.confirm();
    expect(createSession).toHaveBeenCalled();
    expect(updateSessionScenario).not.toHaveBeenCalled();
  });

  it('shows explicit edit save choices instead of relying on a browser prompt', async () => {
    const loadSession = jest.fn().mockResolvedValue({
      id: 'session-1',
      scenario: {
        scenario_type: 'adventure',
        title: 'Old',
        setting: 'Old',
        tone: 'Old',
        character_name: 'Old',
        character_description: 'Old',
        npcs: [],
        rules: [],
      },
    });

    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario: jest.fn(),
            createSession: jest.fn(),
            updateSessionScenario: jest.fn(),
            loadSession,
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => 'session-1',
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Save into current session');
    expect(fixture.nativeElement.textContent).toContain('Save as new session');
  });

  it('restores autosaved wizard state and can discard it', async () => {
    localStorage.setItem('story-companion:wizard:new-session', JSON.stringify({
      prompt: 'Recovered prompt',
      selectedPresetPath: 'scenarios/adventure/heist-city.json',
      advancedOpen: true,
      scenarioJson: JSON.stringify({
        scenario_type: 'adventure',
        title: 'Recovered',
        setting: 'Recovered setting',
        tone: 'tense',
        character_name: 'Nia',
        character_description: 'Recovered description',
        npcs: [],
        rules: [],
      }, null, 2),
      generatedScenario: {
        scenario_type: 'adventure',
        title: 'Recovered',
        setting: 'Recovered setting',
        tone: 'tense',
        character_name: 'Nia',
        character_description: 'Recovered description',
        npcs: [],
        rules: [],
      },
      editorValid: true,
    }));

    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario: jest.fn(),
            createSession: jest.fn(),
            updateSessionScenario: jest.fn(),
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.prompt()).toBe('Recovered prompt');
    expect(fixture.componentInstance.generatedScenario()?.title).toBe('Recovered');
    expect(fixture.nativeElement.textContent).toContain('Recovered unsaved edits');

    fixture.componentInstance.discardRecoveredDraft();

    expect(fixture.componentInstance.prompt()).toBe('A tense fantasy opening where a barred city gate hides a political secret.');
    expect(fixture.componentInstance.generatedScenario()).toBeNull();
    expect(localStorage.getItem('story-companion:wizard:new-session')).toBeNull();
  });

  it('autosaves wizard state and supports clearing the prompt', async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario: jest.fn(),
            createSession: jest.fn(),
            updateSessionScenario: jest.fn(),
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.prompt.set('A fresh prompt');
    fixture.componentInstance.clearPrompt();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.prompt()).toBe('');
    expect(localStorage.getItem('story-companion:wizard:new-session')).toContain('"prompt":""');
  });

  it('shows a clearer step-based wizard structure and descriptive provider labels', async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioWizardComponent],
      providers: [
        provideRouter([]),
        {
          provide: StorySessionService,
          useValue: {
            hydrate: jest.fn().mockResolvedValue(undefined),
            generateScenario: jest.fn(),
            createSession: jest.fn(),
            updateSessionScenario: jest.fn(),
            providerMode: signal<'local' | 'openrouter'>('local'),
            loading: signal(false),
            error: signal<string | null>(null),
            sessions: signal([]),
            setProviderMode: jest.fn(),
          },
        },
        {
          provide: PresetScenarioService,
          useValue: {
            loadIndex: jest.fn().mockResolvedValue([]),
            loadScenario: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenarioWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Step 1');
    expect(text).toContain('Step 2');
    expect(text).toContain('Step 3');
    expect(text).toContain('Local proxy');
    expect(text).toContain('OpenRouter cloud');
  });
});
