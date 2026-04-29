import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureCombat } from './feature-combat';

describe('FeatureCombat', () => {
  let component: FeatureCombat;
  let fixture: ComponentFixture<FeatureCombat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureCombat],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureCombat);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
