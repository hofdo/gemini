---
type: source-summary
tags: [plan, dm-mode, design-spec]
raw: docs/raw/plan-dungeonMasterMode.prompt.md
ingested: 2026-04-23
---

# Source: Dungeon Master Mode Plan

Summary of `docs/raw/plan-dungeonMasterMode.prompt.md` — the design spec for the DM mode feature.

## Core idea

A standalone tab in the Angular app for Dungeon Masters to generate and manage D&D content (NPCs, quests) as reference material — not tied to the chat flow.

## Key decisions from the plan

**NPCs and quests as standalone reference tool** — not injected into the chat. The DM creates them ahead of time and reads them during play. Rationale: DMs need a browsable collection, not a chat history.

**Editable form after generation** — generated content is pre-filled into an editable form so the DM can tweak stats, personality, etc. before saving. Rationale: LLM output is a starting point, not final.

**Advanced toggle for optional quest fields** — long optional fields (complications, rewards detail) are hidden behind an "Advanced" toggle to keep the form clean for quick generation. Rationale: most quick generations don't need them.

## Components specified

- `DmComponent` — main container, two-tab layout (Quests / NPCs)
- `DmNpc`, `Quest`, `DmCollection` — TypeScript data models
- New proxy endpoints: `POST /generate-npc`, `POST /generate-quest`

## Implementation status (as of 2026-04-23)

Fully implemented. The plan matches the actual DmComponent template and proxy endpoints. See → [[dm-mode]] and → [[dm-component]].
