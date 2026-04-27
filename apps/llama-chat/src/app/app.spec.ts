import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { StorageService } from './shared/storage.service';

const storageServiceMock: Partial<StorageService> = {
  save: () => Promise.resolve(),
  load: () => Promise.resolve(null),
  listByPrefix: () => Promise.resolve([]),
  delete: () => Promise.resolve(),
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: StorageService, useValue: storageServiceMock },
      ],
    }).compileComponents();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
