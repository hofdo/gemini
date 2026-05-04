import { TestBed } from '@angular/core/testing';

import { AdventureScenarioEditorComponent } from './adventure-scenario-editor.component';

describe('AdventureScenarioEditorComponent', () => {
  it('emits a valid adventure scenario with core fields and no partner fields in DOM', async () => {
    await TestBed.configureTestingModule({
      imports: [AdventureScenarioEditorComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdventureScenarioEditorComponent);
    const component = fixture.componentInstance;
    const emitted: Array<{ scenario_type: string; title: string }> = [];
    component.scenarioChange.subscribe((value: { scenario_type: string; title: string }) => emitted.push({ scenario_type: value.scenario_type, title: value.title }));

    component.scenario = {
      scenario_type: 'adventure',
      title: 'Ash Gate',
      setting: 'A ruined city gate.',
      tone: 'tense',
      character_name: 'Mira',
      character_description: 'A watch captain.',
      npcs: [{ name: 'Sable', description: 'Smuggler', mode: 'simple' }],
      rules: ['Track consequences'],
    };
    component.update();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(emitted.at(-1)?.scenario_type).toBe('adventure');
    expect(emitted.at(-1)?.title).toBe('Ash Gate');
    expect(fixture.nativeElement.textContent).not.toContain('partner');
  });

  it('exposes a clear form action that resets all structured fields', async () => {
    await TestBed.configureTestingModule({
      imports: [AdventureScenarioEditorComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdventureScenarioEditorComponent);
    const component = fixture.componentInstance;
    const validity: boolean[] = [];
    component.validityChange.subscribe((value) => validity.push(value));

    component.scenario = {
      scenario_type: 'adventure',
      title: 'Ash Gate',
      setting: 'A ruined city gate.',
      tone: 'tense',
      character_name: 'Mira',
      character_description: 'A watch captain.',
      npcs: [{ name: 'Sable', description: 'Smuggler', mode: 'simple' }],
      rules: ['Track consequences'],
    };
    fixture.detectChanges();
    await fixture.whenStable();

    component.clearForm();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.model().title).toBe('');
    expect(component.model().setting).toBe('');
    expect(component.model().character_name).toBe('');
    expect(component.model().npcs).toEqual([]);
    expect(component.model().rules).toEqual([]);
    expect(validity.at(-1)).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Clear form');
  });
});
