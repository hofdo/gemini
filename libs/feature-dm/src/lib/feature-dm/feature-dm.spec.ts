import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureDm } from './feature-dm';

describe('FeatureDm', () => {
  let component: FeatureDm;
  let fixture: ComponentFixture<FeatureDm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureDm],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureDm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
