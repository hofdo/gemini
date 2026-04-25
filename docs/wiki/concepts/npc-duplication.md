---
type: concept
tags: [code-smell, refactoring, npc, duplication]
sources: [dm.component.html, scenario-form.component.html]
updated: 2026-04-23
graph_node_id: concept_npc_duplication
---

# NPC Duplication — Two Creation Flows

**Discovered by graphify as a "surprising connection" (INFERRED, confidence 0.75).**

The app has two separate NPC creation paths that share the same D&D stat model but are implemented independently:

## Flow 1 — DM Mode NPC Creator

- Location: `apps/llama-chat/src/app/dm/dm.component.html` (line 329+)
- Purpose: Standalone NPC reference tool for the DM
- Calls: `POST /generate-npc` via AiAssistService
- Features: Full stat block editor, saved NPCs collection, ability scores grid

## Flow 2 — Scenario Form NPC Card

- Location: `apps/llama-chat/src/app/scenario/scenario-form/scenario-form.component.html` (line 101+)
- Purpose: NPC attached to a chat scenario (as an in-scenario character)
- Calls: `POST /generate-npc` (same endpoint)
- Features: Inline NPC card with ability scores grid, generates for use in the story

## What's duplicated

- Ability scores grid (STR/DEX/CON/INT/WIS/CHA) — identical in both
- `POST /generate-npc` call — same endpoint, likely same request shape
- Basic NPC fields (name, race, class, personality)

## What's different

- DM NPCs are saved to a collection for reference; scenario NPCs are tied to the scenario
- DM NPC is the primary character; scenario NPC is a companion/antagonist in the story
- Different surrounding UI context

## Refactoring opportunity

Extract a shared `NpcFormComponent` / `NpcStatBlockComponent` for the common fields. The two parent components (DmComponent, ScenarioFormComponent) can both use it with different surrounding context. Reduces maintenance: any change to NPC fields currently requires updating two places.
