# R Desktop MVP

Objective: turn `raym33/r` into a local-first desktop workbench for people with medium to high-end personal computers, local models, and explicit permissions.

## Positioning

AI Native OS should not feel like another chat window. It should feel like a local operating surface:

- understands user files and documents;
- searches and reads the web with sources;
- uses local tools on demand;
- asks for clear permission before sensitive actions;
- works with LM Studio, Ollama, or any OpenAI-compatible endpoint.

## First Workflows

1. Documents: summarize PDFs, extract text, merge/split PDFs, and generate reports.
2. Web research: search, read sources, compare, and create linked summaries.
3. Local files: organize folders, detect duplicates, rename, and convert.
4. Data: CSV, JSON, YAML, lightweight SQL, and small statistics.
5. Code: inspect repositories, explain errors, use git, and generate patches.
6. Skill Forge: draft missing skills when the catalog has no good fit.

## PDF Vertical

The first product vertical is document automation for non-technical users:

- Summarize PDF: `ocr.extract_text_from_pdf` because it covers extractable and scanned documents.
- Searchable OCR: `ocr.ocr_to_searchable_pdf`.
- Merge PDFs: `pdftools.pdf_merge`.
- Extract pages: `pdftools.pdf_extract`.
- Generate report: `pdf.generate_pdf` or `pdf.markdown_to_pdf`.
- Repair documents: `pdftools.pdf_rotate` and `pdftools.pdf_compress`.

UX rules: ask for paths before execution, never overwrite originals by default, create new output files, and show the exact tool before running it.

## Recommended Architecture

- Local UI: primary experience for non-technical users.
- Agent runtime: Eve or an equivalent layer with sessions, streaming, and tools.
- Skill router: never load all tools into the model; search relevant tools and execute one exact tool.
- Skill Forge: generate draft skill packages only after catalog search fails.
- Permission layer: block sensitive capabilities by default and surface permission state visually.
- Model adapters: LM Studio, Ollama, OpenAI-compatible endpoints, and optional external APIs.

## Default Safety

Block initially:

- destructive shell operations;
- arbitrary network side effects;
- email and outbound messaging;
- Docker and SSH;
- power, Wi-Fi, and Bluetooth controls;
- clipboard access;
- writes outside allowed folders.

Ideal permissions:

- allow once;
- allow for this session;
- always allow for this agent;
- deny.

## Completed In This Starter

1. Guided workflow panel.
2. Visual R skill and tool explorer backed by `public/r-catalog.json`.
3. Visible permission profile and blocked skill families.
4. Session tool execution history.
5. Guided PDF workbench.
6. Minimal responsive English UI with button tooltips.
7. Skill Forge draft generation for missing capabilities.

## Next Product Steps

1. Persistent results, favorites, and exports.
2. Skill Forge implementation templates for common categories.
3. Firecrawl as the primary web extraction path.
4. Browser-use as an advanced interactive browsing tool.
5. Per-agent permission profiles.
6. File picker and scoped workspace folders.
7. Local run receipts for audit and replay.
