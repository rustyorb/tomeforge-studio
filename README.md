# TomeForge Studio

**The AI writing sandbox for stories that remember themselves.**

A fiction-first AI writing environment for novelists, roleplayers, game writers, and
worldbuilders. A style-matching co-writer, a persistent Story Brain, a ~55-tool
creative Forgebench, and an interactive text-adventure engine — in one local-first
web app.

## Run it

```sh
npm install
npm run dev        # → http://localhost:5199
```

Then open **Settings** and paste your Anthropic API key
(from [console.anthropic.com](https://console.anthropic.com)). The key lives only in
your browser's localStorage and is sent only to Anthropic. All manuscripts and lore
are stored locally in your browser.

## The rooms of the workshop

- **Projects** — every tome keeps its own brain. A demo project, *The Drowned
  Observatory*, ships pre-loaded so you can try everything immediately.
- **Manuscript** — chapters, scenes, and a co-writer: Continue, Extend, Fork ×3,
  Rewrite-without-replacing, chapter tools, presets, pacing and dialogue-ratio dials.
  Nothing overwrites your draft without an explicit Accept/Replace.
- **Story Brain** — the Continuity Core (always-honored memory + canon lock modes),
  the Codex (16 lore entry types with keyword-triggered context inclusion), the Cast
  Ledger (live character state cards), the Threadmap (foreshadowing & payoff
  accounting), the Chronicle (timeline), and an on-demand Continuity Check.
- **Forgebench** — idea, plot, character, dialogue, worldbuilding, revision, and
  publishing tools. Every tool reads the manuscript, the lore, and the current
  creative direction.
- **StoryQuest** — turn the world into a text adventure. Six GM modes, eight
  commands (Do/Say/Think/Inspect/Use/Travel/Wait/Remember), tracked world state,
  and a convert-back-to-prose exit hatch.
- **Voiceprint** — style profiles: nine dials, pacing, POV lock, tense lock, voice notes.

## Stack

Vite · React 18 · TypeScript (strict) · zustand (immer + persist) · Anthropic
Messages API (streaming, direct from browser). No backend; local-first by design.
