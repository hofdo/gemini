import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { ScenarioWizardComponent } from './scenario-wizard.component';
import { StorySessionService } from '../../core/story-session.service';
import { PresetScenarioService } from '../../core/preset-scenario.service';

describe('ScenarioWizardComponent', () => {
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
            providerMode: signal<'local' | 'puter'>('local'),
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
            providerMode: signal<'local' | 'puter'>('local'),
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
      partner_name: '',
      partner_gender: '',
      partner_personality: '',
      partner_body_description: '',
      partner_appearance: '',
      partner_relationship: '',
      partner_likes: '',
      partner_dislikes: '',
      partner_turn_ons: '',
    });
    fixture.componentInstance.editorValid.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    const startButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent?.includes('Start workspace'));

    expect(startButton).toBeTruthy();
    expect(startButton?.disabled).toBe(true);
  });

  it('applies edited scenario to current session when reset is chosen', async () => {
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
            providerMode: signal<'local' | 'puter'>('local'),
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
    fixture.componentInstance.generatedScenario.set({
      scenario_type: 'adventure',
      title: 'New',
      setting: 'New',
      tone: 'New',
      character_name: 'New',
      character_description: 'New',
      npcs: [],
      rules: [],
      partner_name: '',
      partner_gender: '',
      partner_personality: '',
      partner_body_description: '',
      partner_appearance: '',
      partner_relationship: '',
      partner_likes: '',
      partner_dislikes: '',
      partner_turn_ons: '',
    });
    fixture.componentInstance.scenarioJson.set(JSON.stringify(fixture.componentInstance.generatedScenario(), null, 2));
    fixture.componentInstance.editorValid.set(true);

    await fixture.componentInstance.confirm();
    expect(updateSessionScenario).toHaveBeenCalledWith('session-1', expect.objectContaining({ title: 'New' }), true);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('creates a new session from edit flow when new is chosen', async () => {
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
            providerMode: signal<'local' | 'puter'>('local'),
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
      partner_name: '',
      partner_gender: '',
      partner_personality: '',
      partner_body_description: '',
      partner_appearance: '',
      partner_relationship: '',
      partner_likes: '',
      partner_dislikes: '',
      partner_turn_ons: '',
    });
    fixture.componentInstance.scenarioJson.set(JSON.stringify(fixture.componentInstance.generatedScenario(), null, 2));
    fixture.componentInstance.editorValid.set(true);

    await fixture.componentInstance.confirm();
    expect(createSession).toHaveBeenCalled();
    expect(updateSessionScenario).not.toHaveBeenCalled();
  });
});
