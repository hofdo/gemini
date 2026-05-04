# OpenRouter Proxy

This app provides the `/cloud/*` proxy routes used by `story-companion` for the OpenRouter-backed provider.

## Local setup

Copy the example file and create a local-only env file:

```bash
cp apps/openrouter-proxy-ts/.env.example apps/openrouter-proxy-ts/.env.local
```

Then set your real OpenRouter key in `apps/openrouter-proxy-ts/.env.local`:

```env
OPENROUTER_API_KEY=your-real-key
OPENROUTER_MODEL=openai/gpt-5-mini
OPENROUTER_APP_TITLE=Story Companion
OPENROUTER_HTTP_REFERER=http://localhost:4300
OPENROUTER_TEMPERATURE=0.8
OPENROUTER_TOP_P=0.95
```

## Safety

- `apps/openrouter-proxy-ts/.env.local` is ignored by git.
- `.env.example` is safe to commit because it contains placeholders only.
- Shell env vars still override `.env.local`, so you can keep using exported variables if you prefer.
- Do not put real secrets into `.env.example`, source files, or committed JSON/config files.

## Run

```bash
npm run serve:openrouter
```
