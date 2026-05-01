import { TestBed } from '@angular/core/testing';
import { AppError, AppErrorService } from './app-error.service';

describe('AppErrorService', () => {
  let service: AppErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AppErrorService] });
    service = TestBed.inject(AppErrorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise with no error', () => {
    expect(service.currentError()).toBeNull();
  });

  it('should set an error', () => {
    const err: AppError = { type: 'llm_unreachable', message: 'Server down' };
    service.set(err);
    expect(service.currentError()).toEqual(err);
  });

  it('should replace a previous error when set is called again', () => {
    service.set({ type: 'parse_failure', message: 'Bad JSON' });
    const second: AppError = { type: 'quota_exceeded', message: 'Over limit' };
    service.set(second);
    expect(service.currentError()).toEqual(second);
  });

  it('should clear the error', () => {
    service.set({ type: 'abort', message: 'Cancelled' });
    service.clear();
    expect(service.currentError()).toBeNull();
  });

  it('should accept all defined error types', () => {
    const types: AppError['type'][] = [
      'llm_unreachable',
      'parse_failure',
      'quota_exceeded',
      'abort',
    ];

    for (const type of types) {
      service.set({ type, message: `test ${type}` });
      expect(service.currentError()?.type).toBe(type);
    }
  });
});
