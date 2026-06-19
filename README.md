# AI Native OS

**Private local AI assistant for documents, research, and admin work.** — [ainative.so](https://ainative.so)

- Runs on your own machine with LM Studio / Ollama-compatible local models.
- No cloud required for core workflows.
- Human approval before any risky or outward-facing action.

AI Native OS is the local-first, permission-aware layer on top of Eve, LM Studio, and the `raym33/r` skill catalog. It feels less like a generic chat app and more like a small operating system for personal automation: clear status, visible tools, a workspace you control, and safe defaults.

## What can it do?

- Ask for anything in plain language on a clean, single-input first screen — the assistant tells you if it can do it, what it needs, and asks before anything important.
- Open a retro **"OS" desktop** (Windows 3.11 style) and click icons to start common tasks, with a built-in file explorer.
- Summarize a folder of PDFs into a report, or turn scanned PDFs into searchable PDFs.
- Extract fields from Spanish invoices and official documents (NIF/CIF/NIE, IBAN, euro amounts, dates, invoice numbers, fiscal forms).
- Browse your workspace files and act on them (summarize a PDF, pull invoice data) right from the explorer.
- Search the web with a compact local web tool.
- Enable optional packs for deep research notes, Spanish legal sources, Skill Forge, email drafts, and WhatsApp drafts.
- Organize local files safely, preserving the originals.
- Create new local tools through the optional Skill Forge pack, but only after review.

The UI is bilingual (Spanish / English) with a language toggle.

## Features

- Two faces, one app: a clean chat-first welcome screen for new users, and an optional retro **"OS" desktop** with clickable program icons and a file explorer for people who prefer a point-and-click surface.
- Capability registry (`src/osApps.ts`): every function the desktop exposes is one entry, so adding a future skill is one line and nothing gets lost.
- Read-only **file explorer** confined to the workspace (`/api/files`), remembers the last folder, and can hand a file to the assistant (summarize, extract invoice data).
- Spanish document field extractor (`extract_spanish_fields`) for NIF/CIF, IBAN, amounts, dates, invoice numbers, and fiscal forms.
- Local model routing through LM Studio's OpenAI-compatible server.
- Eve agent runtime with streaming and tool calls.
- Confirmation gate + human-in-the-loop approval before outward or irreversible actions (e.g. sending email).
- Web search through SearXNG, Brave, Tavily, or DuckDuckGo Instant Answer fallback.
- Compact default agent profile for local models: only R catalog/tool execution and web search are active by default.
- `raym33/r` bridge with catalog search and targeted tool execution.
- Optional deep research pack with page reading, saved notes, source quality, and Firecrawl extraction.
- Optional Spanish legal research pack via the local Lexia RAG service (`lexia_*` tools) and BOE lookup (`boe_query`).
- Guided PDF workbench for OCR, summaries, merging, page extraction, repair, and report generation.
- Optional Skill Forge pack with a reviewed draft → approve → install pipeline.
- Optional experimental secure communication pack for Gmail/Microsoft 365 drafts and WhatsApp Business Cloud API workflows.
- Run receipts: every executed tool call is logged to `<workspace>/Receipts` and `Logs/receipts.jsonl` for auditability.
- Local setup health endpoint (`/api/health`) covering LM Studio, the selected model, the R catalog, the R bridge, Lexia, search, and workspace mode; `npm run doctor` runs the full stack diagnostic.
- Minimal, responsive, bilingual UI with button tooltips.
- Optional Docker runtime for isolating Node, Eve, Python, and R dependencies.

## Requirements

- Node.js and npm.
- LM Studio with the local server enabled.
- A local model with reliable tool calling.
- Python virtual environment created by the setup flow.
- Optional: SearXNG, Brave Search API key, or Tavily API key for stronger web search.

## Clone

This repository embeds `raym33/r` as a git submodule at `./r`.

```bash
git clone --recurse-submodules https://github.com/raym33/ainativeos.git
cd ainativeos
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

## Configure LM Studio

1. Open LM Studio.
2. Load a model with good tool-calling behavior.
3. Start the local OpenAI-compatible server.
4. Confirm that it responds:

```bash
curl http://127.0.0.1:1234/v1/models
```

Copy the model `id` into `.env`.

**Recommended models.** AI Native OS relies on reliable tool calling, so pick a model that supports it well. **Qwen models are the recommended default** because their output is clean:

- `qwen2.5-7b-instruct` — small, fast, dependable tool calling. A good default.
- `qwen3.5-9b` or a larger Qwen — stronger reasoning if your machine can run it.
- Any LM Studio / Ollama-compatible model with solid function-calling support.

**Note on Gemma.** `gemma-4-26b-a4b` (tested via `npm run doctor:lmstudio` and `npm run doctor:eve`) does call tools correctly, but its replies currently leak Gemma channel/thought control tokens (e.g. `<|channel|>...`) into the visible answer because LM Studio/Eve does not separate those channels. Prefer a Qwen model for a clean chat experience until that is addressed.

After starting LM Studio, verify the whole stack at once with `npm run doctor` (see [Diagnostics](#diagnostics)).

## Configure The App

```bash
cp .env.example .env
npm install
npm run r:install
npm run r:catalog
```

Edit:

```bash
LM_STUDIO_MODEL=qwen2.5-7b-instruct
LM_STUDIO_CONTEXT_TOKENS=1024
LM_STUDIO_MAX_OUTPUT_TOKENS=128
VITE_EVE_TARGET=http://127.0.0.1:4274
```

For a one-command home setup after cloning:

```bash
npm run setup:home
npm run doctor:lmstudio
```

After starting Eve with `npm run start:local`, run:

```bash
npm run doctor:eve
```

`doctor:eve` has a timeout and verifies that the compact agent can complete an R catalog tool turn. If it times out, keep the active tool set small, try a non-reasoning model, or increase the loaded context in LM Studio and match `LM_STUDIO_CONTEXT_TOKENS`.

For web search, configure one provider:

```bash
SEARXNG_URL=http://127.0.0.1:8080
BRAVE_SEARCH_API_KEY=...
TAVILY_API_KEY=...
```

If no provider is configured, the app uses DuckDuckGo Instant Answer as a lightweight fallback. That is useful for smoke tests, but it is not a full web search replacement.

For deeper page extraction, configure Firecrawl:

```bash
FIRECRAWL_API_KEY=...
# Optional for self-hosted Firecrawl:
FIRECRAWL_BASE_URL=https://api.firecrawl.dev
```

Default research tool:

- `web_search`: finds candidate links and returns normalized source cards.

Optional deep research tools live under `optional-tools/research` and can be copied into `agent/tools` when you want a larger agent:

- `fetch_page`: reads one URL and returns clean Markdown.
- `web_research`: searches, reads the best sources, and returns cited research material.
- `save_research_note`: saves a source-backed Markdown note under `~/AI-Native-OS/Reports/Research`.
- `export_research_note`: exports a saved note to PDF and/or clipboard-safe plain text under `~/AI-Native-OS/Reports/Research/Exports`.

The dashboard also includes Research Collections, a local view over saved Markdown notes in the workspace. The local web server exposes read-only endpoints for that folder:

```text
GET /api/research-notes
GET /api/research-notes?id=<filename.md>
```

For serious answers, enable the deep research pack so AI Native OS can read pages instead of relying on snippets alone.

## Experimental Email And WhatsApp

AI Native OS includes opt-in experimental connectors under `optional-tools/experimental` for everyday communication workflows:

- email status checks;
- read-only email metadata/snippet listing;
- guarded Gmail or Microsoft 365 draft creation;
- local WhatsApp reply drafts;
- guarded WhatsApp Business Cloud API sending, disabled by default.

These connectors are not active in the compact default agent. Copy the relevant files from `optional-tools/experimental` into `agent/tools`, rebuild, and provide credentials in `.env`. Email sending is intentionally not implemented; the system can create drafts only. WhatsApp uses the official Business Cloud API, not WhatsApp Web scraping.

See [Experimental Connectors](docs/EXPERIMENTAL_CONNECTORS.md).

## Run

Terminal 1:

```bash
npm run build
npm run start:local
```

Terminal 2:

```bash
npm run web:local
```

Open:

```text
http://127.0.0.1:5173
```

The local Eve backend runs at `http://127.0.0.1:4274` by default. This avoids conflicts with other local apps on port `3000`.

The default context is intentionally conservative (`1024`) because many LM Studio models are loaded with a small context unless you increase it in the model settings. If you raise the context in LM Studio, you can also set `LM_STUDIO_CONTEXT_TOKENS` to `4096`, `8192`, `32768`, or `65536`.

`npm run dev` opens Eve's interactive development mode. For a predictable local LM Studio start, `build` plus `start:local` is usually simpler.

The first screen includes a setup status panel. It checks local runtime readiness through:

```text
http://127.0.0.1:5173/api/health
```

Use it to confirm LM Studio, the selected model, `public/r-catalog.json`, the Python R bridge, optional Lexia, web search configuration, and workspace mode.

## Run With Docker

Docker keeps the workbench runtime isolated while LM Studio stays on the host.

```bash
cp .env.docker.example .env
npm run docker:build
npm run docker:up
```

If you already have a local `.env`, merge the `DOCKER_` values from `.env.docker.example` instead of replacing it.

Open:

```text
http://127.0.0.1:5173
```

See [Docker](docs/DOCKER.md) for the security profile and host networking notes.

## R Skills

This starter includes a bridge to `raym33/r`:

- `r_catalog`: lists available skills.
- `r_search_tools`: searches tools by keyword.
- `r_call_tool`: executes one specific tool.

The R repository lives inside this repo at `./r` as a submodule and is installed editable inside `.venv` with:

```bash
npm run r:install
```

The UI loads `public/r-catalog.json` to display a visual skill and tool explorer. It also shows a permission panel with ready skills and sensitive blocked families.

Quick check:

```bash
.venv/bin/python scripts/r_bridge.py export-catalog --output public/r-catalog.json
.venv/bin/python scripts/r_bridge.py catalog --limit 5
.venv/bin/python scripts/r_bridge.py call math calculate --params '{"expression":"sqrt(144)"}'
```

## The OS desktop

The sidebar has an **OS** button. It opens a Windows 3.11-style "Program Manager" overlay designed for non-technical users: a grid of labelled icons you click to start a task, draggable windows, a taskbar (with an Exit button, a Programs button, one button per open window, and a live clock), and minimize/restore.

- The icons come from a single capability registry, `src/osApps.ts` — one entry per function. Adding a future skill is one line; it then appears on the desktop automatically, so functions never get lost.
- Most icons hand a plain-language request to the assistant (which still applies the confirmation gate and guardrails) and return you to the chat.
- The **File Explorer** is its own window: a read-only listing of your workspace, confined to it (path traversal is rejected), served by `/api/files`. It remembers the last folder across sessions. Select a file to reveal actions — Ask about it, Summarize a PDF, or pull Invoice data — which send the file's path to the assistant.

Icons are original pixel-art SVGs (`src/osIcons.tsx`); no third-party icon assets are bundled.

## PDF Workbench

Guided document actions are available from the OS desktop icons or by simply asking:

- summarize PDFs with text extraction or OCR;
- convert scanned PDFs into searchable PDFs;
- merge multiple PDFs;
- extract pages or ranges;
- generate PDF reports from text or Markdown;
- rotate or compress documents;
- extract fields from Spanish invoices and documents with `extract_spanish_fields`.

Each action asks for paths and options before running `r_call_tool`. The recommended workflow is to create a new output file and preserve originals.

## Skill Forge

Skill Forge is optional. To enable it, copy the files from `optional-tools/forge` into `agent/tools` and rebuild. It provides the safe self-extension path:

```text
request -> search existing tools -> explain the gap -> draft skill -> review -> test -> approve -> install
```

When enabled and the agent cannot find a suitable R skill, it can call `skill_forge` to create a reviewable draft under `skill-drafts/<name>/`.

Drafts include:

- `manifest.json` with status, request, related existing tools, and permission profile;
- `skill.py` with a conservative R skill skeleton;
- `tests/test_skill.py` proving the draft is not executable before implementation;
- `APPROVAL.md` with a human review checklist;
- `README.md` with the original request and review flow.

Drafts are ignored by git by default and are never installed or executed automatically.

## Optional Tool Packs

The default agent is intentionally compact for local models. Optional tools are versioned in `optional-tools/`:

- `optional-tools/research`: page reading, deep research, saved notes, exports.
- `optional-tools/forge`: Skill Forge draft, review, approval, install flow.
- `optional-tools/legal`: Lexia and BOE legal research helpers.
- `optional-tools/news`: ABC.es news helper.
- `optional-tools/experimental`: email and WhatsApp connectors.

To enable a pack, copy its `.ts` files into `agent/tools`, run `npm run build`, and restart Eve. Keep the default compact profile for the most reliable home setup.

## Safety

Two layers protect the user:

- **Blocked skills.** The bridge blocks sensitive skill families by default, including `ssh`, `docker`, `power`, `wifi`, `clipboard`, `social`, and similar capabilities. Unlock them for the backend process with `R_BRIDGE_ALLOW_DANGEROUS=1 npm run start` (keep this disabled for daily use).
- **Confirmation gate + approval.** Outward-facing or irreversible tools (such as `email.send_email`, social posts, and HTTP writes) are *guarded*: they never run automatically. The agent shows a plain-language preview and the app requires an explicit Approve / Cancel before anything is sent. The guarded set is additive and cannot be weakened by configuration.

Generated Skill Forge skills are never installed or executed automatically — they go through a reviewed approve → install pipeline. Originals are preserved by default.

## Diagnostics

Check that everything is wired up with one command:

```bash
npm run doctor
```

It runs three groups and prints a readable summary:

- **R bridge** (offline): catalog, workspace, math, JSON, file write, PDF generate, PDF info, OCR languages, and the workspace guardrail. Run on its own with `npm run doctor:r`.
- **Eve backend**: needs `npm run start`. Run on its own with `npm run doctor:eve`.
- **LM Studio**: needs the local server running. Run on its own with `npm run doctor:lmstudio`.

`npm run doctor` exits non-zero if any check fails, so it also works as a CI gate. For the test suites:

```bash
npm test            # typecheck + Python bridge tests + R skill tests
npm run test:python # bridge tests only (scripts/)
npm run test:r      # R skill tests (r/tests/test_skills.py)
```

## Documentation

- [Product MVP](docs/R_DESKTOP_MVP.md)
- [Project Structure](docs/STRUCTURE.md)
- [Docker](docs/DOCKER.md)
- [Experimental Connectors](docs/EXPERIMENTAL_CONNECTORS.md)
- [Home Quickstart](docs/HOME_QUICKSTART.md)
- [Roadmap](ROADMAP.md)
