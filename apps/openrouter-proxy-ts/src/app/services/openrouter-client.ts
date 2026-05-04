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

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  appTitle: string;
  httpReferer: string;
  temperature: number;
  topP: number;
}

export interface OpenRouterClient {
  complete(messages: ApiMessage[], options?: CompletionOptions): Promise<string>;
  stream(messages: ApiMessage[], options?: CompletionOptions): AsyncIterable<string>;
}

export interface OpenRouterChatResponse {
  choices?: Array<{
    message?: { content?: string | unknown };
    delta?: { content?: string };
  }>;
}

export interface OpenRouterSdk {
  chat: {
    send(
      request: {
        chatRequest: {
          model: string;
          messages: ApiMessage[];
          stream?: false;
          temperature?: number;
          topP?: number;
          responseFormat?: { type: 'json_object' };
          reasoning?: { effort: 'medium' };
        };
      },
      options?: { timeoutMs?: number },
    ): Promise<OpenRouterChatResponse>;
    send(
      request: {
        chatRequest: {
          model: string;
          messages: ApiMessage[];
          stream: true;
          temperature?: number;
          topP?: number;
          reasoning?: { effort: 'medium' };
        };
      },
      options?: { timeoutMs?: number },
    ): Promise<AsyncIterable<OpenRouterChatResponse>>;
  };
}

export type OpenRouterSdkFactory = (config: OpenRouterConfig) => Promise<OpenRouterSdk>;

export function loadOpenRouterConfigFromEnv(): OpenRouterConfig {
  return {
    apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
    model: process.env['OPENROUTER_MODEL'] ?? 'openai/gpt-5-mini',
    appTitle: process.env['OPENROUTER_APP_TITLE'] ?? 'Story Companion',
    httpReferer: process.env['OPENROUTER_HTTP_REFERER'] ?? 'http://localhost:4300',
    temperature: Number(process.env['OPENROUTER_TEMPERATURE'] ?? '0.8'),
    topP: Number(process.env['OPENROUTER_TOP_P'] ?? '0.95'),
  };
}

export function createOpenRouterClient(
  getConfig: () => OpenRouterConfig = loadOpenRouterConfigFromEnv,
  createSdk: OpenRouterSdkFactory = createOfficialSdkClient,
): OpenRouterClient {
  let cachedSdk: Promise<OpenRouterSdk> | undefined;
  let cachedConfigKey: string | undefined;

  return {
    async complete(messages, options = {}) {
      const config = getConfig();
      ensureConfigured(config);
      const openrouter = await getSdk(config);
      const response = await openrouter.chat.send({
        chatRequest: {
          model: config.model,
          messages,
          temperature: options.temperature ?? config.temperature,
          topP: config.topP,
          responseFormat: options.jsonMode ? { type: 'json_object' } : undefined,
          reasoning: options.enableThinking ? { effort: 'medium' } : undefined,
        },
      }, { timeoutMs: options.timeoutMs });
      const content = response.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : JSON.stringify(content ?? '');
    },

    async *stream(messages, options = {}) {
      const config = getConfig();
      ensureConfigured(config);
      const openrouter = await getSdk(config);
      const stream = await openrouter.chat.send({
        chatRequest: {
          model: config.model,
          messages,
          temperature: options.temperature ?? config.temperature,
          topP: config.topP,
          stream: true,
          reasoning: options.enableThinking ? { effort: 'medium' } : undefined,
        },
      }, { timeoutMs: options.timeoutMs });

      for await (const chunk of stream) {
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) yield token;
      }
    },
  };

  function getSdk(config: OpenRouterConfig): Promise<OpenRouterSdk> {
    const configKey = JSON.stringify({
      apiKey: config.apiKey,
      appTitle: config.appTitle,
      httpReferer: config.httpReferer,
    });
    if (!cachedSdk || cachedConfigKey !== configKey) {
      cachedConfigKey = configKey;
      cachedSdk = createSdk(config).catch((error) => {
        cachedSdk = undefined;
        cachedConfigKey = undefined;
        throw error;
      });
    }
    return cachedSdk;
  }
}

async function createOfficialSdkClient(config: OpenRouterConfig): Promise<OpenRouterSdk> {
  const { OpenRouter } = await import('@openrouter/sdk');
  return new OpenRouter({
    apiKey: config.apiKey,
    httpReferer: config.httpReferer,
    appTitle: config.appTitle,
  });
}

function ensureConfigured(config: OpenRouterConfig): void {
  if (!config.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }
}
