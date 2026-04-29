import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureScenario } from './feature-scenario';

describe('FeatureScenario', () => {
  let component: FeatureScenario;
  let fixture: ComponentFixture<FeatureScenario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureScenario],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureScenario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
