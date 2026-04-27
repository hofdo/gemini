import { Injectable, signal } from '@angular/core';

// Phase 3c: Tone Controls
export interface ToneSettings {
  pacing: 'cinematic' | 'deliberate';
  register: 'gritty' | 'balanced' | 'mythic';
  boundary: 'fade' | 'standard' | 'unfiltered';
}

export interface LlmBackend {
  id: string;
  name: string;
  url: string;
  model: string;
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  min_p?: number;
  system_prompt_style?: string;
  context_window?: number;
}

export interface BackendsConfig {
  backends: LlmBackend[];
  active_id: string;
}

const STORAGE_KEY = 'llm_active_backend_id';
const THINKING_KEY = 'llm_enable_thinking';
const TONE_KEY = 'llama-tone-settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  backends = signal<LlmBackend[]>([]);
  activeId = signal<string>('');
  proxyReachable = signal<boolean | null>(null);
  loading = signal(false);
  readonly enableThinking = signal<boolean>(localStorage.getItem(THINKING_KEY) === 'true');
  patchError = signal<string | null>(null);
  contextWindow = signal<number>(8192);

  // Phase 3c: Tone Controls
  readonly toneSettings = signal<ToneSettings>({
    pacing: 'deliberate',
    register: 'balanced',
    boundary: 'standard',
  });

  constructor() {
    try {
      const stored = localStorage.getItem(TONE_KEY);
      if (stored) this.toneSettings.set(JSON.parse(stored));
    } catch { /* ignore */ }
  }

  updateTone(patch: Partial<ToneSettings>): void {
    this.toneSettings.update(t => ({ ...t, ...patch }));
    localStorage.setItem(TONE_KEY, JSON.stringify(this.toneSettings()));
  }

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
      const targetId = savedValid && savedId ? savedId : data.active_id;
      this.activeId.set(targetId);

      // Update contextWindow from the active backend
      const activeBackend = data.backends.find(b => b.id === targetId);
      if (activeBackend?.context_window) {
        this.contextWindow.set(activeBackend.context_window);
      }

      // Sync proxy if localStorage differs
      if (targetId !== data.active_id) {
        try {
          await this._patchBackend(targetId);
        } catch { /* sync failure is non-fatal */ }
      }
    } catch {
      this.proxyReachable.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async setActiveBackend(id: string): Promise<void> {
    this.patchError.set(null);
    try {
      await this._patchBackend(id);
      this.activeId.set(id);
      localStorage.setItem(STORAGE_KEY, id);
      const backend = this.backends().find(b => b.id === id);
      if (backend?.context_window) {
        this.contextWindow.set(backend.context_window);
      }
    } catch (err) {
      this.patchError.set(err instanceof Error ? err.message : 'Switch failed');
    }
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

  setEnableThinking(val: boolean): void {
    this.enableThinking.set(val);
    localStorage.setItem(THINKING_KEY, String(val));
  }

  private async _patchBackend(id: string): Promise<void> {
    const res = await fetch('/config/backend', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error(`Backend switch failed: HTTP ${res.status}`);
  }
}

