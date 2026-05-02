import type { BackendConfig } from '@nx-monorepo-experiment/shared-api-contracts';

const defaultBackends: BackendConfig[] = [
  {
    id: 'gemma4-uncensored',
    name: 'Gemma 4 Uncensored (Q6_K_P)',
    url: process.env['LLAMA_CPP_URL'] ?? 'http://localhost:8080',
    model: 'local-model',
    temperature: 1,
    top_p: 0.95,
    top_k: 64,
    repeat_penalty: 1,
    system_prompt_style: 'narrative',
    context_window: 8192,
  },
  {
    id: 'qwen3-uncensored',
    name: 'Qwen 3.5 9B Uncensored (Q8_0)',
    url: process.env['LLAMA_CPP_URL'] ?? 'http://localhost:8080',
    model: 'local-model',
    temperature: 0.7,
    top_p: 0.8,
    top_k: 20,
    min_p: 0,
    repeat_penalty: 1,
    system_prompt_style: 'narrative',
    context_window: 8192,
  },
];

export interface BackendStore {
  list(): BackendConfig[];
  active(): BackendConfig;
  setActive(id: string): BackendConfig | null;
}

export function loadBackendsFromEnv(): BackendConfig[] {
  const raw = process.env['AVAILABLE_BACKENDS'];
  if (!raw) return defaultBackends;

  try {
    return JSON.parse(raw) as BackendConfig[];
  } catch {
    return defaultBackends;
  }
}

export function createBackendStore(
  backends = loadBackendsFromEnv(),
  activeId = process.env['ACTIVE_BACKEND_ID'] ?? backends[0]?.id,
): BackendStore {
  if (backends.length === 0) {
    throw new Error('At least one LLM backend must be configured.');
  }

  let active = backends.find((backend) => backend.id === activeId) ?? backends[0];

  return {
    list: () => backends,
    active: () => active,
    setActive: (id: string) => {
      const next = backends.find((backend) => backend.id === id);
      if (!next) return null;
      active = next;
      return active;
    },
  };
}
