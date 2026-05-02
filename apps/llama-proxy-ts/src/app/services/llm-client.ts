import type { BackendConfig } from '@nx-monorepo-experiment/shared-api-contracts';

export interface CompletionOptions {
  timeoutMs?: number;
  jsonMode?: boolean;
  enableThinking?: boolean;
  temperature?: number;
}

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmClient {
  complete(messages: ApiMessage[], options?: CompletionOptions): Promise<string>;
  stream(messages: ApiMessage[], options?: CompletionOptions): AsyncIterable<string>;
}

export function createLlmClient(getBackend: () => BackendConfig): LlmClient {
  const buildPayload = (
    backend: BackendConfig,
    messages: ApiMessage[],
    options: CompletionOptions & { stream?: boolean },
  ) => {
    const payload: Record<string, unknown> = {
      model: backend.model,
      messages,
      temperature: options.temperature ?? backend.temperature,
      top_p: backend.top_p,
      top_k: backend.top_k,
      repeat_penalty: backend.repeat_penalty,
    };
    if (backend.min_p !== undefined) payload['min_p'] = backend.min_p;
    if (options.stream) payload['stream'] = true;
    if (options.jsonMode) payload['response_format'] = { type: 'json_object' };
    if (options.enableThinking) {
      payload['thinking'] = { type: 'enabled', budget_tokens: 1024 };
    }
    return payload;
  };

  const post = async (messages: ApiMessage[], options: CompletionOptions & { stream?: boolean }) => {
    const backend = getBackend();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

    try {
      const response = await fetch(`${backend.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(backend, messages, options)),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`LLM HTTP ${response.status}: ${await response.text()}`);
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    async complete(messages, options = {}) {
      const response = await post(messages, options);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    },

    async *stream(messages, options = {}) {
      const response = await post(messages, { ...options, stream: true });
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ') || line.startsWith('data: [DONE]')) continue;
          const chunk = JSON.parse(line.slice(6)) as { choices?: Array<{ delta?: { content?: string } }> };
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) yield token;
        }
      }
    },
  };
}
