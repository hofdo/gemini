---
type: concept
tags: [feature, dm-mode, dnd, design]
sources: [plan-dungeonMasterMode.prompt.md, dm.component.ts, dm.component.html, dm.model.ts]
updated: 2026-04-23
---

# Dungeon Master Mode

A standalone D&D toolset for generating and managing quests and NPCs — separate from the interactive chat.

## Purpose

DM Mode is a reference tool, not a chat interface. The DM uses it before/between sessions to:
- Generate D&D 2024-compliant NPCs with full stat blocks
- Generate quests with encounter tables and monster stats
- Save, browse, and edit their generated content

The NPCs and quests created here are **not** sent to the chat — they're a prep tool. This is the key design decision from the plan: DM content is standalone reference material.

## Data model

```typescript
interface DmNpc {
  name, race, class, background, alignment,
  abilityScores: { str, dex, con, int, wis, cha },
  hp, ac, speed, savingThrows, skills,
  actions, reactions, personality, appearance
}

interface Quest {
  title, hook, setting, tone, difficulty,
  encounters: Encounter[],  // each with monster table
  rewards, complications
}

interface DmCollection {
  npcs: DmNpc[],
  quests: Quest[]
}
```

## Generation endpoints

- `POST /generate-npc` — D&D 2024 NPC, returns structured JSON
- `POST /generate-quest` — quest with encounters, returns structured JSON

Both go through [[ai-assist-service]] → [[llama-proxy]] → llama-server.

## NPC duplication issue

An NPC stats grid (STR/DEX/CON/INT/WIS/CHA) also exists inside [[scenario-form]] for scenario NPCs. Two separate NPC creation flows exist in the app. See → [[npc-duplication]] for analysis.

## Navigation

Accessible from the main menu (DM mode card). Route is `/dm`.
