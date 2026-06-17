# AI Native OS

**Private local AI assistant for documents, research, and admin work.** — [ainative.so](https://ainative.so)

- Runs on your own machine with LM Studio / Ollama-compatible local models.
- No cloud required for core workflows.
- Human approval before any risky or outward-facing action.

AI Native OS is the local-first, permission-aware layer on top of Eve, LM Studio, and the `raym33/r` skill catalog. It feels less like a generic chat app and more like a small operating system for personal automation: clear status, visible tools, a workspace you control, and safe defaults.

## What can it do?

- Summarize a folder of PDFs into a report.
- Turn scanned PDFs into searchable PDFs.
- Search the web and write cited research notes.
- Look up Spanish legislation (BOE) and local legal sources (Lexia) with citations.
- Draft emails and documents — without sending anything automatically.
- Organize local files safely, preserving the originals.
- Create new local tools through Skill Forge, but only after review.

The UI is bilingual (Spanish / English) with a language toggle.

## Features

- Local model routing through LM Studio's OpenAI-compatible server.
- Eve agent runtime with streaming and tool calls.
- Confirmation gate + human-in-the-loop approval before outward or irreversible actions (e.g. sending email).
- Web search through SearXNG, Brave, Tavily, or DuckDuckGo Instant Answer fallback.
- `raym33/r` bridge with catalog search and targeted tool execution.
- Spanish legal research via the local Lexia RAG service (`lexia_*` tools) and BOE lookup (`boe_query`).
- Guided PDF workbench for OCR, summaries, merging, page extraction, repair, and report generation.
- Skill Forge with a reviewed draft → approve → install pipeline (nothing is installed or executed automatically).
- Permission panel that shows ready and blocked skill families.
- Session tool history for auditability.
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
git clone --recurse-submodules https://github.com/raym33/r-eve-desktop-starter.git
cd r-eve-desktop-starter
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

## Configure The App

```bash
cp .env.example .env
npm install
npm run r:install
npm run r:catalog
```

Edit:

```bash
LM_STUDIO_MODEL=your-local-model-id
LM_STUDIO_CONTEXT_TOKENS=65536
LM_STUDIO_MAX_OUTPUT_TOKENS=4096
```

For web search, configure one provider:

```bash
SEARXNG_URL=http://127.0.0.1:8080
BRAVE_SEARCH_API_KEY=...
TAVILY_API_KEY=...
```

If no provider is configured, the app uses DuckDuckGo Instant Answer as a lightweight fallback. That is useful for smoke tests, but it is not a full web search replacement.

## Run

Terminal 1:

```bash
npm run build
npm run start
```

Terminal 2:

```bash
npm run web
```

Open:

```text
http://127.0.0.1:5173
```

If Eve is not running at `http://127.0.0.1:3000`, change `VITE_EVE_TARGET` in `.env`.

`npm run dev` opens Eve's interactive development mode. For a predictable local LM Studio start, `build` plus `start` is usually simpler.

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

## PDF Workbench

The first screen includes guided document actions:

- summarize PDFs with text extraction or OCR;
- convert scanned PDFs into searchable PDFs;
- merge multiple PDFs;
- extract pages or ranges;
- generate PDF reports from text or Markdown;
- rotate or compress documents.

Each action asks for paths and options before running `r_call_tool`. The recommended workflow is to create a new output file and preserve originals.

## Skill Forge

Skill Forge is the safe self-extension path:

```text
request -> search existing tools -> explain the gap -> draft skill -> review -> test -> approve -> install
```

When the agent cannot find a suitable R skill, it can call `skill_forge` to create a reviewable draft under `skill-drafts/<name>/`.

Drafts include:

- `manifest.json` with status, request, related existing tools, and permission profile;
- `skill.py` with a conservative R skill skeleton;
- `tests/test_skill.py` proving the draft is not executable before implementation;
- `APPROVAL.md` with a human review checklist;
- `README.md` with the original request and review flow.

Drafts are ignored by git by default and are never installed or executed automatically.

## Safety

Two layers protect the user:

- **Blocked skills.** The bridge blocks sensitive skill families by default, including `ssh`, `docker`, `power`, `wifi`, `clipboard`, `social`, and similar capabilities. Unlock them for the backend process with `R_BRIDGE_ALLOW_DANGEROUS=1 npm run start` (keep this disabled for daily use).
- **Confirmation gate + approval.** Outward-facing or irreversible tools (such as `email.send_email`, social posts, and HTTP writes) are *guarded*: they never run automatically. The agent shows a plain-language preview and the app requires an explicit Approve / Cancel before anything is sent. The guarded set is additive and cannot be weakened by configuration.

Generated Skill Forge skills are never installed or executed automatically — they go through a reviewed approve → install pipeline. Originals are preserved by default.

## Documentation

- [Product MVP](docs/R_DESKTOP_MVP.md)
- [Project Structure](docs/STRUCTURE.md)
- [Docker](docs/DOCKER.md)
- [Roadmap](ROADMAP.md)
