import { Injectable, signal } from '@angular/core';

export interface LlmBackend {
  id: string;
  name: string;
  url: string;
  model: string;
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
}

export interface BackendsConfig {
  backends: LlmBackend[];
  active_id: string;
}

const STORAGE_KEY = 'llm_active_backend_id';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  backends = signal<LlmBackend[]>([]);
  activeId = signal<string>('');
  proxyReachable = signal<boolean | null>(null);
  loading = signal(false);

  async loadConfig(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await fetch('/config/backends');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BackendsConfig = await res.json();
      this.backends.set(data.backends);
      this.proxyReachable.set(true);

      // Prefer the id the user last chose (localStorage), fall back to proxy default
      const savedId = localStorage.getItem(STORAGE_KEY);
      const savedValid = savedId && data.backends.some(b => b.id === savedId);
      const targetId = savedValid ? savedId! : data.active_id;
      this.activeId.set(targetId);

      // Sync proxy if localStorage differs
      if (targetId !== data.active_id) {
        await this._patchBackend(targetId);
      }
    } catch {
      this.proxyReachable.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async setActiveBackend(id: string): Promise<void> {
    await this._patchBackend(id);
    this.activeId.set(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  async checkHealth(): Promise<void> {
    try {
      const res = await fetch('/health');
      this.proxyReachable.set(res.ok);
    } catch {
      this.proxyReachable.set(false);
    }
  }

  activeBackend(): LlmBackend | undefined {
    return this.backends().find(b => b.id === this.activeId());
  }

  private async _patchBackend(id: string): Promise<void> {
    await fetch('/config/backend', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }
}

