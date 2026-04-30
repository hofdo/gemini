import { Injectable, signal } from '@angular/core';

export type AppErrorType = 'llm_unreachable' | 'parse_failure' | 'quota_exceeded' | 'abort';

export interface AppError {
  type: AppErrorType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AppErrorService {
  readonly currentError = signal<AppError | null>(null);
  private _retryHandler: (() => void) | null = null;

  set(err: AppError): void {
    this.currentError.set(err);
  }

  clear(): void {
    this.currentError.set(null);
  }

  registerRetryHandler(fn: () => void): void {
    this._retryHandler = fn;
  }

  retry(): void {
    this.clear();
    this._retryHandler?.();
  }
}
