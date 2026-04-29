import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedSettings } from './shared-settings';

describe('SharedSettings', () => {
  let component: SharedSettings;
  let fixture: ComponentFixture<SharedSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedSettings],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedSettings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
