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
    component.scenarioChange.subscribe((value) => emitted.push({ scenario_type: value.scenario_type, title: value.title }));

    component.scenario = {
      scenario_type: 'adventure',
      title: 'Ash Gate',
      setting: 'A ruined city gate.',
      tone: 'tense',
      character_name: 'Mira',
      character_description: 'A watch captain.',
      npcs: [{ name: 'Sable', description: 'Smuggler', mode: 'simple' }],
      rules: ['Track consequences'],
      partner_name: '',
      partner_gender: '',
      partner_personality: '',
      partner_body_description: '',
      partner_appearance: '',
      partner_relationship: '',
      partner_likes: '',
      partner_dislikes: '',
      partner_turn_ons: '',
    };
    component.update();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(emitted.at(-1)?.scenario_type).toBe('adventure');
    expect(emitted.at(-1)?.title).toBe('Ash Gate');
    expect(fixture.nativeElement.textContent).not.toContain('partner');
  });
});
