# TomeForge Studio — Design (v0.1)

Date: 2026-07-05. Source: user-provided product spec (treated as the approved design;
session ran autonomously). This document records the implemented scope and architecture.

## Product thesis

A fiction-first AI writing sandbox: style-matching co-writer + persistent Story Brain
(memory, lore, continuity) + modular creative toolbench + interactive text-adventure
engine, in one local-first web app.

## Scope of v0.1 (this build)

| Spec system | Product name | Implemented as |
|---|---|---|
| Project dashboard | Projects | Create/open/delete projects, seed demo project |
| Co-writing sandbox | Manuscript | Chapter/scene tree, prose editor, Continue / Extend / Fork ×3 / Rewrite / Chapter tools, preset + pacing + dialogue-ratio controls, branches drawer |
| Memory Box | Continuity Core | Always-injected memory text + canon-lock modes (loose/guided/strict/sandbox) |
| Lorebook | Codex | 16 entry types, aliases, keyword-matched context inclusion, always-include pin, AI drafting |
| Author's Note | Director's Note | Injected last in system prompt (strongest steering) |
| Character State Cards | Cast Ledger | Full live cards + AI sync-from-manuscript |
| Foreshadowing tracker | Threadmap | Threads by kind/status + AI payoff suggestions |
| Timeline Keeper | Chronicle | Ordered events with reorder |
| Continuity Engine | Continuity Check | On-demand AI contradiction report vs. canon |
| AI Tools | Forgebench | ~55 data-driven tools across 7 categories (idea/plot/character/dialogue/world/revision/publishing) |
| Style Profiles | Voiceprint | 9 dials + pacing + POV/tense locks, assignable per project |
| Model & Presets | Presets | 12 presets adjusting temperature + directive |
| Text Adventure Engine | StoryQuest | 6 GM modes, 8 commands, JSON world-state tracking, convert-to-prose |

Deferred beyond v0.1: multi-user/cloud sync, export formats beyond copy/notes,
timeline auto-extraction, per-scene style overrides, branching saves inside StoryQuest.

## Architecture

- **Stack:** Vite + React 18 + TypeScript (strict), zustand (immer + persist →
  localStorage), react-router (HashRouter). No backend.
- **AI:** Anthropic Messages API called directly from the browser
  (`anthropic-dangerous-direct-browser-access`), streaming SSE. User supplies their own
  API key in Settings (stored only in localStorage). Model selectable
  (Sonnet 5 default, Opus 4.8, Haiku 4.5).
- **Story Brain context assembly** (`src/lib/context.ts`): every generation's system
  prompt = fiction-engine identity → project header → canon-mode directive →
  Continuity Core → keyword-matched Codex entries (name/alias scan of recent text +
  always-include) → Cast Ledger digest → Voiceprint style directives (incl. POV/tense
  locks) → preset directive → task directive → Director's Note last (recency = strongest).
- **Data model:** single `Project` aggregate (chapters/scenes, memory, authorNote,
  canonMode, codex, characters, threads, timeline, notes, quest, branches) mutated via
  one immer-recipe entry point `updateProject(id, draft => …)`.
- **StoryQuest state protocol:** GM replies end with a mandatory fenced ```json world
  state block; the client parses/merges it and strips it from the narration.
- **Module layout:** `src/features/{dashboard,manuscript,brain,forgebench,storyquest,voiceprint,settings}`,
  each owning its directory; shared types/store/lib/components are frozen interfaces.

## Non-goals / principles

- Original drafts are never destroyed by generation: continuations require Accept,
  rewrites require explicit Replace, forks can be saved as branches.
- Stays inside the fiction: system prompt forbids assistant chatter/meta-commentary.
- Local-first: all writing stays in the browser unless the user calls the API.
