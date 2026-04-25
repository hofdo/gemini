# Plan: Streaming LLM Responses

## Goal

Switch from waiting for the complete LLM response to **streaming tokens in real-time** via Server-Sent Events (SSE). The user sees text appear token-by-token as the LLM generates it, dramatically improving perceived responsiveness.

---

## Steps

### 1. Update backend to stream SSE through to the client

**File:** `apps/llama-proxy/main.py`

- Add `"stream": true` to the payload sent to llama.cpp's `/v1/chat/completions`.
- Replace the current `ChatResponse` return with a `StreamingResponse` (media type `text/event-stream`).
- Use `httpx.AsyncClient.stream()` to iterate over SSE chunks from llama.cpp.
- Parse each `data: {...}` line, extract `choices[0].delta.content`, and yield it as an SSE event to the frontend.
- On `data: [DONE]`, close the stream.
- Keep the existing non-streaming `/chat` endpoint working (or add a `stream` query param / request field to opt in).

**Approach:** Add a `stream: bool = False` field to `ChatRequest`. When true, return `StreamingResponse`; when false, behave as today. This keeps backward compatibility and lets the frontend opt in.

```python
from fastapi.responses import StreamingResponse

@app.post("/chat")
async def chat(request: ChatRequest):
    # ... build api_messages as before ...

    if request.stream:
        return StreamingResponse(
            stream_chat(api_messages),
            media_type="text/event-stream",
        )
    else:
        # ... existing non-streaming logic ...


async def stream_chat(api_messages: list[dict[str, str]]):
    payload = {
        "model": "local-model",
        "messages": api_messages,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", f"{LLAMA_CPP_URL}/v1/chat/completions", json=payload) as resp:
            async for line in resp.aiter_lines():
                if line.startswith("data: [DONE]"):
                    break
                if line.startswith("data: "):
                    yield line + "\n\n"
```

### 2. Update frontend ChatService to consume SSE stream

**File:** `apps/llama-chat/src/app/chat/chat.service.ts`

- Replace `HttpClient.post()` with the native `fetch()` API for streaming requests (Angular's HttpClient doesn't support SSE streaming from POST).
- Read the response body as a `ReadableStream`, decode chunks, parse SSE `data:` lines.
- On each token: update the last `assistant` message in the `messages` signal by appending the new content.
- Create a placeholder assistant message when the stream starts, then grow it token-by-token.
- Set `loading` to false when the stream completes.

**No external dependencies needed** — the browser's native `fetch` + `ReadableStream` + `TextDecoder` is sufficient.

```typescript
async sendMessageStreaming(content: string, inputType: InputType = 'dialogue'): Promise<void> {
  // ... build payload with stream: true ...

  // Add placeholder assistant message
  this.messages.update(msgs => [...msgs, { role: 'assistant', content: '' }]);

  const response = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    // Parse SSE lines, extract delta.content, append to last message
    for (const line of text.split('\n')) {
      if (line.startsWith('data: [DONE]')) break;
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.slice(6));
        const token = json.choices?.[0]?.delta?.content ?? '';
        if (token) {
          this.messages.update(msgs => {
            const updated = [...msgs];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, content: last.content + token };
            return updated;
          });
        }
      }
    }
  }

  this.loading.set(false);
}
```

### 3. Update `initializeStory()` to also stream

**File:** `apps/llama-chat/src/app/chat/chat.service.ts`

- Reuse the same streaming logic for the story initialization request (empty messages + scenario).
- Extract the streaming fetch logic into a shared private method like `_streamRequest(payload)`.

### 4. Update ChatComponent — no changes needed

The component already reactively renders `chatService.messages()`. Since the signal updates on each token, the UI will automatically show text appearing in real-time. The typing indicator (`▋`) can be removed or kept as a fallback for non-streaming mode.

### 5. Add `stream` field to `ChatRequest`

**File:** `apps/llama-proxy/main.py`

```python
class ChatRequest(BaseModel):
    messages: list[StoryMessage]
    scenario: Scenario | None = None
    stream: bool = False
```

---

## Data Flow (streaming)

```
User sends message
        │
        ▼
ChatService.sendMessageStreaming()
  fetch('/chat', { stream: true, messages, scenario })
        │
        ▼
POST /chat (llama-proxy)
  ├── build system prompt + format messages
  ├── stream=true → StreamingResponse
  └── httpx.stream("POST", llama.cpp, stream=true)
        │
        ▼
llama.cpp yields SSE chunks:
  data: {"choices":[{"delta":{"content":"The "}}]}
  data: {"choices":[{"delta":{"content":"forest "}}]}
  ...
  data: [DONE]
        │
        ▼
llama-proxy yields each chunk through to frontend
        │
        ▼
ChatService parses each SSE line
  → appends token to last assistant message signal
  → Angular re-renders incrementally
```

---

## Considerations

- **No new dependencies** — uses native `fetch` + `ReadableStream` on frontend, `StreamingResponse` + `httpx.stream` on backend.
- **Backward compatible** — `stream` defaults to `false`, so existing non-streaming behavior is preserved.
- **Error handling** — if the stream errors mid-way, append an error indicator to the partial message and set loading to false.
- **Proxy config** — the Angular dev server proxy (`proxy.conf.json`) may need `"changeOrigin": true` but should pass SSE through fine by default.
- **Auto-scroll** — `ngAfterViewChecked` already scrolls to bottom, so it will keep up with streaming tokens.

