<div align="center">

# 🕯️ TomeForge Studio

### *The AI writing sandbox for stories that remember themselves.*

![React](https://img.shields.io/badge/React_18-1b1712?style=for-the-badge&logo=react&logoColor=e0763a)
![TypeScript](https://img.shields.io/badge/TypeScript_strict-1b1712?style=for-the-badge&logo=typescript&logoColor=c9a35c)
![Vite](https://img.shields.io/badge/Vite-1b1712?style=for-the-badge&logo=vite&logoColor=e0763a)
![Local First](https://img.shields.io/badge/local--first-no_backend-1b1712?style=for-the-badge&logoColor=6fae9b)
![Bring Your Own Key](https://img.shields.io/badge/BYOK-7_AI_providers-1b1712?style=for-the-badge&logoColor=c9a35c)

A fiction-first AI writing environment for **novelists, roleplayers, game writers, and worldbuilders** —
a style-matching co-writer, a persistent Story Brain, a 71-tool creative workshop, and an
interactive text-adventure engine. Not a chatbot with a manuscript window taped to its forehead.

**Everything stays in your browser. Your words, your keys, your canon.**

</div>

---

## ⚡ Quick start

```sh
npm install
npm run dev        # → http://localhost:5199
```

> **Windows:** just double-click **`start.bat`** (and `stop.bat` to shut down cleanly).

Then open **Settings** and connect a brain:

| Cloud (bring your key) | Local (no key at all) |
|---|---|
| Anthropic · OpenAI · OpenRouter · Groq · Mistral | **LM Studio** (`localhost:1234`) · **Ollama** (`localhost:11434`) |

Click **↻ Fetch models** to pull the live model list from whichever provider you pick.
Keys live only in your browser's localStorage and are sent only to the provider you chose.
A demo project — *The Drowned Observatory* — ships pre-loaded so every feature is explorable immediately.

---

## 🧠 The Story Brain

The part that makes it different. Every generation — every continuation, tool run, and GM turn —
is assembled from the project's living memory:

```mermaid
flowchart TD
    A[✒ Your prose<br/><i>recent manuscript tail</i>] --> CTX
    B[⚙ Continuity Core<br/><i>plot goal · current conflict · hard rules</i>] --> CTX
    C[⁂ Codex<br/><i>16 lore types, keyword-triggered by aliases</i>] --> CTX
    D[☙ Cast Ledger<br/><i>live character states · voice notes · forbidden behavior</i>] --> CTX
    E[📜 Story So Far<br/><i>Archivist scene summaries</i>] --> CTX
    F[❦ Voiceprint<br/><i>9 style dials · POV lock · tense lock</i>] --> CTX
    G[🎚 Preset<br/><i>12 modes: Slow Burn → Wild Brainstorm</i>] --> CTX
    H[🎬 Director's Note<br/><i>strongest steering, injected last</i>] --> CTX
    CTX{{Context Assembly}} --> LLM[(Your chosen model)]
    LLM --> OUT[Prose that remembers<br/>your canon]
```

- **Canon Lock** — four modes from *Loose* (invent freely) to *Strict* (no new world facts, ever)
- **Continuity Check** — one click asks the AI to hunt contradictions: resurrected characters, forgotten injuries, broken timelines
- **The Archivist** — scans your manuscript for uncatalogued recurring names and offers one-click AI-drafted Codex entries; writes scene summaries that become long-range memory
- **Relationship Web** — an AI-woven, draggable force-graph of every bond, grudge, and secret in your cast
- **Threadmap** — a tiny goblin accountant for narrative promises: clues planted, questions raised, payoffs owed
- **Chronicle** — the timeline keeper for mysteries, epics, and anything with time travel

---

## 🗺️ The rooms of the workshop

| Room | What happens there |
|---|---|
| **✒ Manuscript** | The co-writing sandbox: **Continue · Extend · Fork ×3 · Rewrite-without-replacing**, ghost-text suggestions (`Ctrl+Space`, `Tab` to accept), Focus Mode with typewriter scrolling, read-aloud, writing sprints, scene snapshots (a time machine per scene), drag-and-drop outline, find & replace |
| **⁂ Story Brain** | Continuity Core · Codex · Cast Ledger · Threadmap · Chronicle · Archivist · Continuity Check |
| **⚒ Forgebench** | **71 tools** across Idea, Plot, Character, Dialogue, World, Revision, Publishing — every one reads your Story Brain |
| **⚔ StoryQuest** | Text-adventure engine: 6 GM modes, 8 commands (*Do, Say, Think, Inspect, Use, Travel, Wait, Remember*), tracked world state, **timeline branches** ("what if she accepts the duel?"), d20 rolls, convert-any-branch-to-prose |
| **❦ Voiceprint** | Style profiles: prose density, vocabulary, dialogue frequency, darkness, surrealism… plus POV and tense locks |
| **◍ Insights** | GitHub-style writing heatmap, streaks, daily goal ring with ember-burst, manuscript composition stats |
| **⇲ Import & Export** | EPUB · styled HTML · Markdown · RTF (Word) · plain text · Story Bible · full JSON backup/restore · **SillyTavern import** |

<details>
<summary><b>🎭 All 71 Forgebench tools</b></summary>

| Category | Tools |
|---|---|
| **Idea** | Premise Generator · What-If Engine · Story Seed · Title Generator · Logline Generator · Genre Mashup · Trope Inverter · Plot Twist · Ending Generator · Theme Finder |
| **Plot** | Three-Act Builder · Save the Cat · Hero's Journey · Mystery Clue Map · Romance Arc · Villain Plan · Chapter Outline · Scene Cards · Reverse Outline · Plot Hole Detector |
| **Character** | Character Generator · Arc Builder · Backstory · Motivation Mapper · Relationship Web · Voice Profile · Conflict Generator · Character Interview · Cast Balance Report |
| **Dialogue** | Conversation Generator · One-Liners · Subtext Enhancer · Argument Builder · Banter · Exposition Softener · Voice Consistency Check · Screenplay ⇄ Prose Converters |
| **World** | Nation · City · Magic System · Technology · Religion · Creature · Artifact · Language Seed · Faction · Economy · Map Prompt · Cultural Conflict |
| **Revision** | Developmental Edit · Line Edit · Copy Edit · Tone Check · Pacing Report · Compression · Expansion · Show-Don't-Tell · Sensory Pass · Dialogue Tightening · Prose Polish · Readability · Chapter Summary |
| **Publishing** | Back-Cover Blurb · Query Letter · Synopsis · Character List · Series Bible · Ebook Metadata · Content Notes · Adaptation Pitch |

</details>

<details>
<summary><b>📥 SillyTavern import details</b></summary>

Drop `.json` or card `.png` files onto **Import & Export → Outside Worlds**:

- **Character cards** — V1 legacy, V2 (`chara_card_v2`), V3 (`chara_card_v3`), including data embedded in PNG `chara`/`ccv3` chunks → become Codex entries + Cast Ledger cards
- **Lorebooks / World Info** — both the spec `character_book` shape and SillyTavern's native format → become Codex entries; trigger keys become aliases so keyword-matched context injection keeps working exactly like ST
- `constant` entries become *always include*; disabled entries are skipped; greetings and chat prompts are deliberately ignored — TomeForge is a manuscript, not a chat

</details>

---

## ⌨️ Keyboard

| Keys | Does |
|---|---|
| `Ctrl` `K` | Command deck — jump anywhere, run any tool, search every scene, codex entry, and character |
| `Ctrl` `Space` | Ghost suggestion at the caret |
| `Tab` / `Esc` | Accept / dismiss the ghost |
| `Esc` | Exit Focus Mode |
| `Ctrl` `/` | Shortcut help |

---

## 🛡️ Principles

1. **Your draft is sacred.** Generations require an explicit *Accept*; rewrites require an explicit *Replace*; destructive AI actions snapshot the scene first. The original is never silently overwritten.
2. **Stays inside the fiction.** The system prompt forbids assistant chatter, lectures, and meta-commentary.
3. **Local-first.** No backend, no accounts, no telemetry. Words leave your machine only when *you* call your chosen AI provider. Full JSON backup gets everything out anytime.

## 🏗️ Stack

React 18 · TypeScript (strict) · Vite · zustand (immer + persist) · jszip (EPUB) — and **three themes**: Ink & Ember 🕯️, Parchment 📜, Abyss 🌊.

<div align="center">

*It is not here to replace the writer. It is here to hold the lantern while the writer walks deeper into the labyrinth.*

</div>
