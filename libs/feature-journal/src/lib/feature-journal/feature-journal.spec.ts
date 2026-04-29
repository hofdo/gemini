import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureJournal } from './feature-journal';

describe('FeatureJournal', () => {
  let component: FeatureJournal;
  let fixture: ComponentFixture<FeatureJournal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureJournal],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureJournal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
