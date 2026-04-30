import { Injectable, effect, inject, signal } from '@angular/core';
import { WorldState } from './world-state.model';
import { StorageService } from './storage.service';

const CURRENT_SCHEMA_VERSION = 3;
const STORAGE_KEY_PREFIX = 'llama-world-state-';
const WORLD_INDEX_KEY = 'llama-world-index';

type WorldIndex = { id: string; title: string; lastUpdated: string }[];

@Injectable({ providedIn: 'root' })
export class WorldStateStore {
  private storageService = inject(StorageService);
  readonly state = signal<WorldState | null>(null);

  constructor() {
    effect(() => {
      const current = this.state();
      if (current) {
        this.persistNow(current).catch(err =>
          console.warn('WorldStateStore: async persist failed', err)
        );
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        const current = this.state();
        if (current) {
          try {
            localStorage.setItem('worldState_fallback', JSON.stringify(current));
          } catch { /* storage full — ignore */ }
        }
      });
    }
  }

  update(fn: (s: WorldState) => WorldState): void {
    this.state.update(s => s ? fn(s) : s);
  }

  async loadForScenario(scenarioTitle: string): Promise<boolean> {
    try {
      const index = await this.storageService.load<WorldIndex>(WORLD_INDEX_KEY);
      if (index) {
        const entry = index.find(e => e.title === scenarioTitle);
        if (entry) {
          const parsed = await this.storageService.load<Partial<WorldState>>(
            `${STORAGE_KEY_PREFIX}${entry.id}`
          );
          if (parsed) {
            this.state.set(this.migrate(parsed));
            return true;
          }
        }
      }
    } catch { /* fall through */ }

    // Fallback: linear scan via prefix
    try {
      const keys = await this.storageService.listByPrefix(STORAGE_KEY_PREFIX);
      for (const key of keys) {
        const parsed = await this.storageService.load<Partial<WorldState>>(key);
        if (parsed?.scenarioTitle === scenarioTitle) {
          this.state.set(this.migrate(parsed));
          return true;
        }
      }
    } catch { /* give up */ }

    return false;
  }

  clearState(): void {
    const s = this.state();
    if (s) {
      void this.storageService.delete(`${STORAGE_KEY_PREFIX}${s.id}`);
    }
    this.state.set(null);
  }

  exportToFile(): void {
    const state = this.state();
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-state-${state.scenarioTitle.replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<WorldState>;
      if (!parsed.id || !parsed.scenarioTitle) return false;
      const migrated = this.migrate(parsed);
      this.state.set(migrated);
      return true;
    } catch {
      return false;
    }
  }

  persistNow(state: WorldState): Promise<void> {
    return this._persistNow(state);
  }

  private async _persistNow(state: WorldState): Promise<void> {
    await this.storageService.save(`${STORAGE_KEY_PREFIX}${state.id}`, state);
    const index: WorldIndex = (await this.storageService.load<WorldIndex>(WORLD_INDEX_KEY)) ?? [];
    const entry = { id: state.id, title: state.scenarioTitle, lastUpdated: state.lastUpdated };
    const existingIdx = index.findIndex(e => e.id === state.id);
    if (existingIdx >= 0) {
      index[existingIdx] = entry;
    } else {
      index.push(entry);
    }
    await this.storageService.save(WORLD_INDEX_KEY, index);
  }

  migrate(raw: Partial<WorldState>): WorldState {
    const version = raw._schemaVersion ?? 0;

    if (version < 1) {
      raw.worldClock = raw.worldClock ?? { dayNumber: 1, timeOfDay: 'morning', season: 'spring', turnsPerDay: 8 };
      raw.archivedEventCount = raw.archivedEventCount ?? 0;
      raw.archivedEventSummary = raw.archivedEventSummary ?? '';
      raw.currentScene = raw.currentScene ?? null;
      raw.keyFacts = raw.keyFacts ?? [];
      raw.sessionSummaries = raw.sessionSummaries ?? [];
      raw.locations = raw.locations ?? [];
      raw.factions = raw.factions ?? [];
      raw.npcStates = raw.npcStates ?? [];
      raw.storyEvents = raw.storyEvents ?? [];
    }

    if (version < 3) {
      raw.questLog = raw.questLog ?? [];
      raw.playerCharacter = raw.playerCharacter ?? null;
      raw.choiceChronicle = raw.choiceChronicle ?? [];
      raw.storyBeat = raw.storyBeat ?? null;
      raw.ambientQueue = raw.ambientQueue ?? [];
      raw.bondState = raw.bondState ?? null;
    }

    raw.combatState = raw.combatState ?? null;

    return {
      ...raw,
      _schemaVersion: CURRENT_SCHEMA_VERSION,
    } as WorldState;
  }
}
