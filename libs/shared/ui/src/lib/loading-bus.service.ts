import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingBusService {
  private readonly _keys = signal<Record<string, boolean>>({});

  readonly chatLoading = computed(() => this._keys()['chat'] ?? false);
  readonly worldUpdateLoading = computed(() => this._keys()['worldUpdate'] ?? false);
  readonly assistLoading = computed(() => this._keys()['assist'] ?? false);
  readonly anyLoading = computed(() => Object.values(this._keys()).some(Boolean));

  set(key: 'chat' | 'worldUpdate' | 'assist', value: boolean): void {
    this._keys.update((keys) => ({ ...keys, [key]: value }));
  }
}
