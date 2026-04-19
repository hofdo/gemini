import { Injectable, signal } from '@angular/core';
import { Scenario } from './scenario.model';

const STORAGE_KEY = 'llama-scenario';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  readonly activeScenario = signal<Scenario | null>(this.load());

  setScenario(scenario: Scenario): void {
    this.activeScenario.set(scenario);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
  }

  clearScenario(): void {
    this.activeScenario.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private load(): Scenario | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Scenario) : null;
    } catch {
      return null;
    }
  }
}

