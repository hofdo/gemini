---
type: entity
tags: [frontend, angular, god-node, dm-mode]
sources: [plan-dungeonMasterMode.prompt.md, dm.component.html, dm.component.ts]
updated: 2026-04-23
graph_node_id: dm_component_dmcomponent
---

# DmComponent

**God node — 48 edges in the knowledge graph. The most connected node in the codebase.**

Located at `apps/llama-chat/src/app/dm/`. Implements the entire Dungeon Master toolset as a single Angular standalone component.

## What it does

Two tabs, each with a full create → generate → edit → save → browse flow:

**Quests tab**
- Quest creator form (title, tone, setting, difficulty, length, advanced fields)
- Calls `POST /generate-quest` via [[ai-assist-service]]
- Editable result card with full quest details
- Encounters section with monster table
- Saved quests collection (browse/delete)

**NPCs tab**
- NPC creator form (name, race, class, role, personality, background)
- Calls `POST /generate-npc` via [[ai-assist-service]]
- Editable result card with full stat block
- D&D 2024 ability scores grid (STR/DEX/CON/INT/WIS/CHA)
- Saved NPCs collection (browse/delete)

## Why it's a god node

The original plan (`docs/raw/plan-dungeonMasterMode.prompt.md`) put all DM functionality into a single component. The graph confirms this: DmComponent directly owns quest creation, quest results, encounter management, saved quests, NPC creation, NPC results, NPC stats, and saved NPCs — 48 edges.

## Refactoring signal

Cohesion score: **0.04** (very low — the community's nodes barely interconnect, meaning they're loosely coupled internally). The graph's "Suggested Questions" flagged this: *Should DmComponent be split into smaller, more focused modules?*

Natural split:
- `DmQuestComponent` — quest tab
- `DmNpcComponent` — NPC tab
- `DmSavedComponent` — shared saved-items browsing

## Connections

- Uses [[ai-assist-service]] for generation calls
- Model types: `DmNpc`, `Quest`, `DmCollection` in `dm.model.ts`
- Accessible from [[menu-component]] (DM mode card)
- NPC stats grid is semantically similar to [[scenario-form]]'s NPC stats grid → see [[npc-duplication]]
