import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedWorldState } from './shared-world-state';

describe('SharedWorldState', () => {
  let component: SharedWorldState;
  let fixture: ComponentFixture<SharedWorldState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedWorldState],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedWorldState);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
