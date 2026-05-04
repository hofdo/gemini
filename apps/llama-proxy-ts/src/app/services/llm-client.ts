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

export interface LlmClientRequestStartEvent {
  backendId: string;
  backendUrl: string;
  model: string;
  messageCount: number;
  messages: ApiMessage[];
  timeoutMs?: number;
  stream: boolean;
  jsonMode: boolean;
  enableThinking: boolean;
  temperature?: number;
}

export interface LlmClientRequestSuccessEvent {
  backendId: string;
  model: string;
  stream: boolean;
  durationMs: number;
  responseLength?: number;
  chunkCount?: number;
  totalChars?: number;
}

export interface LlmClientRequestErrorEvent {
  backendId: string;
  model: string;
  stream: boolean;
  durationMs: number;
  statusCode?: number;
  errorMessage: string;
}

export interface LlmClientHooks {
  onRequestStart?(event: LlmClientRequestStartEvent): void;
  onRequestSuccess?(event: LlmClientRequestSuccessEvent): void;
  onRequestError?(event: LlmClientRequestErrorEvent): void;
}

export function createLlmClient(getBackend: () => BackendConfig, hooks: LlmClientHooks = {}): LlmClient {
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
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
    hooks.onRequestStart?.({
      backendId: backend.id,
      backendUrl: backend.url,
      model: backend.model,
      messageCount: messages.length,
      messages,
      timeoutMs: options.timeoutMs,
      stream: options.stream ?? false,
      jsonMode: options.jsonMode ?? false,
      enableThinking: options.enableThinking ?? false,
      temperature: options.temperature ?? backend.temperature,
    });

    try {
      const response = await fetch(`${backend.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(backend, messages, options)),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        hooks.onRequestError?.({
          backendId: backend.id,
          model: backend.model,
          stream: options.stream ?? false,
          durationMs: Date.now() - startedAt,
          statusCode: response.status,
          errorMessage: `LLM HTTP ${response.status}: ${errorText}`,
        });
        throw new Error(`LLM HTTP ${response.status}: ${errorText}`);
      }
      return { response, backend, startedAt };
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith('LLM HTTP '))) {
        hooks.onRequestError?.({
          backendId: backend.id,
          model: backend.model,
          stream: options.stream ?? false,
          durationMs: Date.now() - startedAt,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    async complete(messages, options = {}) {
      const { response, backend, startedAt } = await post(messages, options);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? '';
      hooks.onRequestSuccess?.({
        backendId: backend.id,
        model: backend.model,
        stream: false,
        durationMs: Date.now() - startedAt,
        responseLength: content.length,
      });
      return content;
    },

    async *stream(messages, options = {}) {
      const { response, backend, startedAt } = await post(messages, { ...options, stream: true });
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let totalChars = 0;

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
          if (token) {
            chunkCount += 1;
            totalChars += token.length;
            yield token;
          }
        }
      }
      hooks.onRequestSuccess?.({
        backendId: backend.id,
        model: backend.model,
        stream: true,
        durationMs: Date.now() - startedAt,
        chunkCount,
        totalChars,
      });
    },
  };
}
