# CLAUDE.md — Second Brain Schema

This file is both the codebase guide and the operating schema for the LLM wiki system. Every session follows these rules.

---

## Directory Layout

```
project/
  raw/          immutable source documents (plan files, articles, notes)
  wiki/         LLM-maintained knowledge base
    index.md    catalog of all wiki pages — read this first
    log.md      append-only session log
    entities/   components, services, systems, files
    concepts/   patterns, design decisions, open questions
    sources/    summaries of raw documents
  graphify-out/ knowledge graph (rebuild with /graphify .)
apps/           Nx monorepo — Angular + FastAPI + llama-server (DO NOT MOVE)
scripts/        shell scripts (DO NOT MOVE)
```

---

## Context Navigation Protocol

**Before reading any file, follow this order:**

1. **Check the wiki first.** Read `project/wiki/index.md` to find the relevant page. If it exists and is current, use it.
2. **Query the knowledge graph** for structural questions: `/graphify query "your question"` against `project/graphify-out/graph.json`
3. **Read raw files only** if the user explicitly says "read the file" or the wiki page is missing/stale.

Never read raw source files speculatively. The wiki exists to avoid that.

---

## Ingest Protocol

When the user adds a new source (drops a file into `project/raw/`, pastes text, links an article):

1. **Read the source** and discuss key takeaways with the user
2. **Write a source summary** to `project/wiki/sources/<slug>.md` with frontmatter:
   ```yaml
   ---
   type: source-summary
   tags: [...]
   raw: project/raw/<filename>
   ingested: YYYY-MM-DD
   ---
   ```
3. **Update or create entity pages** for any named concepts, components, or systems mentioned
4. **Update or create concept pages** for any design decisions, patterns, or open questions
5. **Update `project/wiki/index.md`** — add rows to the relevant tables
6. **Append to `project/wiki/log.md`** with format: `## [YYYY-MM-DD] ingest | Source Title`
7. **Update cross-references** — add `See → [[page]]` links on related pages

A single source typically touches 3–8 pages. Do all of it in one pass.

---

## Query Protocol

When answering questions about the project:

1. Check `project/wiki/index.md` for a relevant page
2. Read that page (and the pages it links)
3. If the wiki doesn't cover it, run `/graphify query "..."` or read the raw file
4. Answer with citations: `(→ [[page]])` for wiki, `(→ file:line)` for raw code
5. **If the answer reveals something non-obvious, file it back** — create or update a concept page so the knowledge compounds

---

## Wiki Page Conventions

### Frontmatter (required on every page)

```yaml
---
type: entity | concept | source-summary
tags: [tag1, tag2]
sources: [file1, file2]   # for entity/concept pages
updated: YYYY-MM-DD
---
```

### Cross-references

Use `[[page-name]]` for wiki-internal links (matches Obsidian link format). Always prefer a wiki link over re-explaining something that has its own page.

### Staleness

Add a `> ⚠️ Last verified: YYYY-MM-DD` callout when you're uncertain a page is current. Update the `updated:` frontmatter whenever you modify a page.

---

## Lint Protocol

When the user asks for a wiki health check or says "lint the wiki":

1. Check for **pages in index.md that don't exist** on disk
2. Check for **pages on disk not listed** in index.md
3. Look for **stale `updated:` dates** — pages not touched in the last major feature cycle
4. Look for **concepts mentioned in entity pages** that don't have their own concept page
5. Check for **duplicate coverage** — two pages saying the same thing
6. Suggest **new sources to ingest** based on gaps

---

## Knowledge Graph

The graphify graph at `project/graphify-out/graph.json` is the structural map of the codebase.

- **Rebuild**: run `/graphify .` from the repo root (outputs to `project/graphify-out/` — update the graphify command path accordingly)
- **Query**: `/graphify query "your question"`
- **God nodes**: highest-edge nodes = core abstractions — `DmComponent` (48 edges), `ScenarioFormComponent` (26), `llama-proxy` (16)
- **Last run**: 2026-04-23 — 270 nodes, 346 edges, 38 communities

---

## Log Format

Every session that modifies the wiki appends to `project/wiki/log.md`:

```markdown
## [YYYY-MM-DD] <operation> | <description>

One paragraph summary. What changed, what was decided, what was discovered.
```

Operations: `setup`, `ingest`, `query`, `fix`, `refactor`, `lint`.

---

## Codebase Quick Reference

### What this project is

An interactive RPG/storytelling platform:

```
llama-chat (Angular 21, :4200)
    ↓ proxies /chat, /assist, /generate-*, /config, /health
llama-proxy (FastAPI, :8000)
    ↓ orchestrates LLM calls
llm (llama-server / llama.cpp, :8080)
```

### Start commands

```bash
npm run dev                  # standard model
npm run dev:uncensored       # uncensored model variant
```

### Individual services

```bash
npx nx serve llama-chat      # Angular dev server (:4200)
npx nx serve llama-proxy     # FastAPI backend (:8000)
npx nx serve llm             # llama-server (:8080)
```

### Build / lint / test

```bash
npx nx run-many -t lint test build e2e
npx nx test llama-chat
npx nx e2e llama-chat-e2e
```

### Tech stack

- Frontend: Angular 21.1, TypeScript, SCSS, RxJS 7.8, standalone components
- Backend: FastAPI, Uvicorn, Pydantic, httpx
- LLM: llama.cpp (llama-server), Gemma-4 models (obliterated Q8_0 / uncensored Q6_K_P)
- Monorepo: Nx 22.5.2 | Testing: Jest 30 + Playwright | Linting: ESLint 9 + Ruff

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLAMA_CPP_URL` | `http://localhost:8080` | LLM server URL |
| `HF_TOKEN` | — | HuggingFace token for private models |
| `AVAILABLE_BACKENDS` | defined in main.py | JSON list of backend configs |
| `ACTIVE_BACKEND_ID` | first backend | Active backend on startup |
| `LLAMA_PORT` | `8080` | Override llama-server port |
