import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedScenario } from './shared-scenario';

describe('SharedScenario', () => {
  let component: SharedScenario;
  let fixture: ComponentFixture<SharedScenario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedScenario],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedScenario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
