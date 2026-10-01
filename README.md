<p align="center">
  <img src="docs/images/llm-wiki-compiler-hero.png" alt="llm-wiki-compiler: an owl scribe at a desk turns a row of raw PDF, Markdown, text and web sources into a linked, cited wiki that a librarian keeps, for humans and AI agents to ask questions" width="100%">
</p>

<h1 align="center">llm-wiki-compiler</h1>

<p align="center"><b>Compile raw sources into an interlinked, citation-traceable markdown wiki — then browse, query, review, lint, export and serve it to people and AI agents, with optional domain profiles for typed knowledge systems.</b></p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <a href="package.json"><img alt="Node.js 24+" src="https://img.shields.io/badge/node-%3E%3D24-339933.svg?logo=nodedotjs&logoColor=white"></a>
  <a href="tsconfig.json"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?logo=typescript&logoColor=white"></a>
  <a href="https://www.npmjs.com/package/llm-wiki-compiler"><img alt="npm package: llm-wiki-compiler" src="https://img.shields.io/badge/npm-llm--wiki--compiler-CB3837.svg?logo=npm&logoColor=white"></a>
  <a href="https://llmwiki.atomicstrata.ai"><img alt="docs: llmwiki.atomicstrata.ai" src="https://img.shields.io/badge/docs-llmwiki.atomicstrata.ai-blue"></a>
</p>

<p align="center"><b>English</b> | <a href="README.ru.md">Русский</a></p>

> Fork of [atomicstrata/llm-wiki-compiler](https://github.com/atomicstrata/llm-wiki-compiler). The upstream license and credits are unchanged. This fork's `main` may differ from the version published to npm.

```bash
npm install -g llm-wiki-compiler
llmwiki quickstart ./notes.md      # ingest one source, compile pages, open the viewer
llmwiki query "what are the key ideas?"
```

**llmwiki** (the CLI of this repo; npm package `llm-wiki-compiler`) compiles raw sources into an interlinked, citation-traceable markdown wiki that agents and humans can browse, query, lint, export, and reuse. The default profile preserves the classic concepts-and-queries layout; optional profiles add domain-specific types and workflows without adding domain branches to the compiler.

llmwiki implements the [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) pattern: instead of re-discovering knowledge from raw files at query time, compile it once into durable pages that accumulate structure, provenance, review state, and retrieval metadata over time.

Around the compiler the repository ships ingestion of several source types, incremental recompilation and stale-page repair, grounded queries and agent-ready context packs, a local read-only viewer, a review queue with an optional review policy, lint and an eval harness, an MCP server and a TypeScript SDK, Open Knowledge Format and other exports, several LLM providers, and Configurable Lifecycle Profiles (typed entities, relations, workflows, artifacts, connectors) with two built-in templates.

It is early software, and not every surface is equally settled: the `workflow` commands are labelled experimental in the CLI help, the SDK's profile, workflow and artifact methods are marked `@experimental`, and a few items are still listed under *Unreleased* in the [changelog](CHANGELOG.md). See [Status and known limits](#status-and-known-limits).

> **New in 1.0:** Configurable Lifecycle Profiles turn llmwiki into a reusable domain knowledge substrate. Declare typed entities, relations, lifecycle gates, workflows, artifacts, connectors, and retrieval policy in one validated profile. Start with the built-in `autosci` research pack or the deliberately different `newsroom` editorial pack, or install a local declarative template.

**Contents:** [In plain words](#in-plain-words) · [What's inside](#whats-inside) · [Why llmwiki?](#why-llmwiki) · [How it works](#how-it-works) · [Quick start](#quick-start) · [Profiles (CLP)](#configurable-lifecycle-profiles-clp) · [Agent decision guide](#agent-decision-guide) · [Core commands](#core-commands) · [Open Knowledge Format](#open-knowledge-format) · [What llmwiki creates](#what-llmwiki-creates) · [Agent integration](#agent-integration) · [Configuration](#configuration) · [Quality and safety](#quality-and-safety-model) · [Status and limits](#status-and-known-limits) · [Documentation](#documentation) · [Contributing](#contributing)

## In plain words

### The problem

Notes, papers, READMEs, transcripts, PDFs and saved web pages pile up as loose files. Searching them means re-reading them, and asking an AI about them means sending the raw text again every time: nothing is remembered, related ideas in different files are never joined, and when an answer comes back you cannot easily tell which source it came from or whether that source has changed since.

### Who it is for

People and teams with a collection of sources worth turning into lasting knowledge — a research folder, codebase docs, a team handbook, standards, design notes, decision logs. People who build AI agents and want them to read one stable, cited context pack instead of the raw files. Advanced users can add review gates, quality thresholds for CI, a typed domain model (profiles), or embed the compiler through MCP or TypeScript.

### What you get from it

- **A wiki you can read as plain files.** Pages are markdown with YAML frontmatter under `wiki/`, linked with `[[wikilinks]]`; the layout can be opened as an Obsidian vault.
- **Claims you can trace.** Pages cite source files and line ranges, and `llmwiki lint` checks that those citations and links resolve.
- **Work done once.** Only new or changed sources go through the LLM again; stale pages are detected and can be repaired with a targeted recompile.
- **Several ways to use it.** Ask questions from the CLI, browse in a local viewer, request a context pack for another agent, expose it over MCP, or call it from TypeScript.
- **Control over generated content.** Hold risky pages in a review queue, run lint and an eval harness, and gate CI on thresholds.
- **Portability.** Export to `llms.txt`, JSON, JSON-LD, GraphML, Marp and Open Knowledge Format; import OKF bundles (staged for review by default).
- **An optional domain model.** A validated profile can declare typed entities, relations, lifecycle gates, workflows and artifacts, enforced by the write path.

### What it is not

- Not a general static-site generator, a heavy ontology database, or a replacement for plain search over fast-changing raw logs.
- Not LLM-free: `compile`, `query` and other generation steps send content to the LLM provider you configure. Read-only commands (`lint`, `status`, the viewer, `eval` fast suite) need no provider.
- Not infallible: pages are generated by a model, so review, lint and eval exist for a reason. The viewer is read-only, and MCP workflow actions are hard-capped below trusted writes and cannot satisfy human gates.
- Not a hosted service: it runs on your machine against files in your project.
- Not equally mature everywhere: see the status labels below.

### Glossary

| Term | Meaning here |
|---|---|
| **Source** | A raw input file under `sources/` — an ingested URL, PDF, image description, transcript, markdown or text file, or an agent session export. |
| **Compile** | The two-phase LLM step that extracts concepts from changed sources and then writes wiki pages. |
| **Wiki page** | A compiled markdown page under `wiki/`, with a kind: `concept`, `entity`, `comparison` or `overview`. |
| **Citation** | A marker such as `^[paper.md:42-58]` tying a claim to a source file and line range. |
| **Stale / orphaned** | A page is *stale* when a source it came from has changed, and *orphaned* when every source it came from was deleted. |
| **Review candidate** | A generated page held under `.llmwiki/candidates/` until you approve or reject it. |
| **Review policy** | An optional `.llmwiki/config.json` rule set that holds only risky pages. With no policy, nothing is held. |
| **Context pack** | A compact, citation-aware evidence bundle built from the wiki for one task or question. |
| **Profile (CLP)** | A validated `.llmwiki/profile.json` that declares typed entities, relations, lifecycle gates, workflows and retrieval policy. |
| **OKF** | Open Knowledge Format: a portable, markdown-native way to exchange compiled knowledge. |
| **MCP** | Model Context Protocol: how agents call llmwiki's tools over stdio. |

## What's inside

Status labels: unlabeled = implemented on this fork's `main`; **experimental** = marked experimental in the CLI help or the SDK types; **unreleased** = listed under *Unreleased* in [CHANGELOG.md](CHANGELOG.md), i.e. not in the latest release the changelog records (1.1.0).

### Getting sources in

- **`ingest`.** Fetches a URL (web pages, Wikipedia, arXiv, YouTube transcripts) or reads a local file (PDF, image, transcript, markdown or text) into `sources/`; very long content is truncated and flagged. → [Core commands](#core-commands), [`docs/cli/ingest.mdx`](docs/cli/ingest.mdx)
- **`ingest-session`.** Imports Claude, Codex or Cursor session exports. → [`docs/cli/ingest.mdx`](docs/cli/ingest.mdx)
- **`quickstart`, `next`, `watch`.** One-step ingest and compile with a viewer handoff; a read-only recommendation of the next action; automatic recompile when `sources/` changes. → [Quick start](#quick-start)
- **`rm <source>`** (**unreleased**). Deletes a source and the concept pages derived only from it (typed entity pages of a non-default profile are left untouched and must be removed by hand), with a `--dry-run` preview. → [Core commands](#core-commands)

### Compiling

- **Two-phase compile.** Extract concepts from changed sources, then generate typed pages with citations and wikilinks; unchanged sources are not sent to the LLM again. Concurrency is configurable. → [How it works](#how-it-works), [`docs/concepts/how-it-works.mdx`](docs/concepts/how-it-works.mdx)
- **`refresh --stale`, `recover`.** `refresh --stale` recompiles the changed sources that own stale pages, without compiling unrelated new sources; pages whose sources were all deleted are only cleaned up (marked orphaned), with no recompile and no LLM call, because no owner is left. `recover` reverts the journal of a crashed compile. → [Quality and safety model](#quality-and-safety-model)
- **Language and layout.** `--lang` sets the output language; a generated `wiki/index.md` and a `wiki/MOC.md` Map of Content for Obsidian-style browsing. → [What llmwiki creates](#what-llmwiki-creates)

### Asking and using the wiki

- **`query`.** Grounded answers. With an embedding index it retrieves chunks by embedding and BM25-reranks them; when the chunk search is unavailable or finds nothing, the model picks the pages instead (from the page-level embedding hits if there are any, otherwise from the list of live pages), which costs one extra provider call; there is no lexical search. Wikilink-graph expansion is not part of `query`; it belongs to `context`. `--save` turns an answer into a page. → [`docs/cli/query.mdx`](docs/cli/query.mdx)
- **`context`.** A citation-aware evidence pack for an agent, as markdown or stable JSON. → [Agent decision guide](#agent-decision-guide)
- **`view`.** A read-only local browser viewer with search, page metadata, graph exploration, freshness badges and citation chips; binds to loopback unless you opt in. → [`docs/cli/view.mdx`](docs/cli/view.mdx)
- **`status`.** Page and source counts, stale and orphaned pages, pending work, review queue and state health, with `--json`. → [`docs/cli/status.mdx`](docs/cli/status.mdx)

### Trust and quality

- **Review queue.** `compile --review` holds every generated page; a review policy holds only risky ones (low confidence, contradicted, schema- or provenance-violating); `review list|show|approve|reject` processes the queue. With no policy and no `--review`, nothing is held. → [Quality and safety model](#quality-and-safety-model), [`docs/configuration/review-policy.mdx`](docs/configuration/review-policy.mdx)
- **`lint`.** Deterministic, no-LLM checks for broken links and citations, duplicates, stale and orphaned pages, low confidence and cross-link rules. → [`docs/cli/lint-eval.mdx`](docs/cli/lint-eval.mdx)
- **`eval`.** Health score, per-page health, graph health, citation coverage and precision, and (full suite) LLM-judged citation support, with history, cache and CI thresholds. → [`docs/guides/ci-quality-gates.mdx`](docs/guides/ci-quality-gates.mdx)
- **`rules`.** Extract, review and export machine-actionable rule candidates for a downstream rule importer. → [`docs/cli/lint-eval.mdx`](docs/cli/lint-eval.mdx)
- **State recovery.** `state reset --yes` backs up and resets `state.json`; invalid review config aborts compile instead of disabling review. → [`docs/troubleshooting/state-recovery.mdx`](docs/troubleshooting/state-recovery.mdx)

### Agents and code

- **MCP server.** `llmwiki serve` exposes tools for ingest, compile, query, page search and read, lint, status, eval, context packs, artifact verification, OKF export/import and workflow actions, plus `llmwiki://` resources. → [Agent integration](#agent-integration)
- **SDK.** `createWiki({ root })` drives ingest, compile, query, search, pages, sources, status, lint, context, export, eval and OKF from TypeScript. Its profile, workflow and artifact methods are **experimental**. → [Agent integration](#agent-integration)

### Exchange

- **Export.** `llms.txt`, `llms-full.txt`, JSON, JSON-LD, GraphML and Marp by default; `okf` with `--target okf`. → [`docs/cli/export.mdx`](docs/cli/export.mdx)
- **OKF import.** Review-first by default; `--trusted` writes live; `--dry-run` previews. → [Open Knowledge Format](#open-knowledge-format)

### Domain profiles (CLP)

- **Profiles and templates.** `.llmwiki/profile.json` declares typed entities, relations, lifecycle gates and retrieval; `profile init|show|validate|diff`; built-in `autosci` (research) and `newsroom` (editorial) templates, local templates, and signed template taps and publishing. → [Configurable Lifecycle Profiles](#configurable-lifecycle-profiles-clp)
- **Workflows** (**experimental**). Declared stages, gates, outputs and actions, driven by `llmwiki workflow …`. → [`docs/cli/workflow.mdx`](docs/cli/workflow.mdx)
- **Artifacts and connectors.** Hash-pinned artifacts (`artifact write|verify`) and first-party connectors (Crossref, opt-in) that stage external records as review candidates. → [`docs/cli/connector.mdx`](docs/cli/connector.mdx)

### Providers

- **Chat and tool calls.** Anthropic, Claude Agent SDK local login, OpenAI-compatible servers, Ollama, MiniMax, GitHub Copilot and Atlas Cloud (**unreleased**). → [Configuration](#configuration)
- **Embeddings.** Served by the active provider where it has an embedding endpoint, or by a separate `LLMWIKI_EMBEDDING_PROVIDER` (**unreleased**). → [`docs/configuration/environment-variables.mdx`](docs/configuration/environment-variables.mdx)

### Not built

The repository states no roadmap items. Things it explicitly is not: a static-site generator, an ontology database, or a hosted service. Atomic Memory, the companion runtime-memory project, is a separate repository ([Companion](#companion-atomic-memory)).

## Why llmwiki?

<a id="when-to-use-this-repo"></a>

- **If** you have papers, notes, READMEs, transcripts, PDFs, images, or web pages, **then** llmwiki compiles them into typed wiki pages instead of leaving them as a pile of loose files.
- **If** you build agents, **then** it gives them a stable, citation-aware context pack instead of making them re-read raw files for every question.
- **If** generated knowledge must stay auditable, **then** source citations, review queues, freshness checks, and quality gates are built in.
- **If** you want to use the result your way, **then** browse it locally, query it from the CLI, expose it over MCP, or embed it through the SDK.
- **If** you need to exchange compiled knowledge with other tools, **then** export and import Open Knowledge Format (OKF), JSON, JSON-LD, GraphML, Marp, and `llms.txt`.

llmwiki is **not** a general static-site generator, a heavy ontology database, or a replacement for ad-hoc search over fast-changing raw logs. It is strongest when source knowledge is worth compiling, reviewing, and reusing.

## Features

<a id="what-you-get"></a>

- **Compiled wiki, not chunks** — a two-phase LLM pipeline extracts concepts, then generates typed pages: `concept`, `entity`, `comparison`, and `overview`.
- **Citation-traceable output** — paragraphs and claims cite source files and line ranges, and `llmwiki lint` validates the links.
- **Configurable Lifecycle Profiles** — a fail-closed `.llmwiki/profile.json` declares entity schemas, relations, lifecycle gates, workflows, and retrieval policy; see [CLP](#configurable-lifecycle-profiles-clp).
- **Hybrid retrieval** — `query` combines semantic chunk search with BM25 reranking; `context` builds compact evidence packs for agents from lexical ranking, semantic chunks (when embeddings exist) and wikilink-graph expansion.
- **Review policy and freshness repair** — with `compile --review` or a review policy in `.llmwiki/config.json`, risky generated pages are held for review (by default nothing is held); stale pages are surfaced and repaired with `llmwiki refresh --stale`.
- **Local viewer, MCP server, SDK** — `llmwiki view`, `llmwiki serve`, and `createWiki({ root })` cover humans, agents, and TypeScript code.
- **Open Knowledge Format exchange** — portable, markdown-native import/export, plus JSON, JSON-LD, GraphML, Marp, and `llms.txt`.
- **Provider portable** — Anthropic, Claude Agent SDK local login, OpenAI-compatible servers, Ollama, GitHub Copilot, Atlas Cloud, and local OpenAI-compatible runtimes.

<details>
<summary>Full feature list</summary>

- **Compiled wiki, not chunks.** A two-phase LLM pipeline extracts concepts, then generates typed pages: `concept`, `entity`, `comparison`, and `overview`.
- **Configurable Lifecycle Profiles.** A fail-closed `.llmwiki/profile.json` can declare entity schemas, typed relations, lifecycle state machines, transition requirements, workflows, artifacts, connectors, content tiers, and retrieval policy.
- **Installable domain templates.** `llmwiki template init autosci` creates a research project with papers, ideas, experiments, manuscripts, evidence artifacts, workflows, and Crossref import. `newsroom` demonstrates the same machinery for editorial work.
- **Runtime trust gates.** Relation, evidence, artifact, and human/agent gates are enforced by the write path rather than left as prompt conventions; standing lint detects drift after the fact.
- **Citation-traceable output.** Paragraphs and claims cite source files and line ranges, and `llmwiki lint` validates the links.
- **Hybrid retrieval.** `query` combines semantic chunk search with BM25 reranking; `context` builds compact evidence packs for agents from lexical ranking, semantic chunks (when embeddings exist) and wikilink-graph expansion.
- **Local viewer.** `llmwiki view` opens a read-only browser UI with search, page metadata, graph exploration, source-freshness badges, and citation chips.
- **Review policy.** Generated pages can be auto-held for review when confidence, contradiction, schema, or provenance rules trip.
- **Freshness repair.** `llmwiki lint` and `llmwiki next` surface stale/orphaned pages; `llmwiki refresh --stale` repairs changed knowledge without compiling unrelated new sources.
- **Eval harness.** `llmwiki eval` reports health score, a per-page health distribution that flags the worst pages, wikilink-graph health, citation coverage/precision, corpus stats, regression deltas, and optional judge-model citation support.
- **MCP server.** `llmwiki serve` exposes ingest, compile, query, lint, read, status, eval, context-pack, and OKF exchange tools to MCP-compatible agents.
- **SDK.** `createWiki({ root })` drives ingest, compile, query, context, status, export, eval, and OKF import/export from TypeScript without shelling out.
- **Open Knowledge Format exchange.** Export and import OKF bundles for portable, markdown-native knowledge exchange. External OKF imports are staged through the review queue by default; trusted bundles can be written live explicitly.
- **Other portable exports.** Export JSON, JSON-LD, GraphML, Marp slides, and `llms.txt` for downstream systems.
- **Provider portable.** Anthropic, Claude Agent SDK local login, OpenAI-compatible servers, Ollama, GitHub Copilot, Atlas Cloud, and local OpenAI-compatible runtimes.

</details>

## How it works

<p align="center">
  <img src="docs/images/llm-wiki-compiler-how-it-works.png" alt="llm-wiki-compiler: several raw source files go through one LLM compile step that finds concepts and writes pages, producing a wiki of linked pages with citations that people and agents then query" width="100%">
</p>

1. **Ingest.** `llmwiki ingest <url-or-file>` fetches a URL or copies a local file into `sources/`.
2. **Compile once.** `llmwiki compile` extracts concepts and then writes typed pages (`concept`, `entity`, `comparison`, `overview`) with cited source files and line ranges. Only changed sources flow through the LLM again.
3. **Review and check.** With `--review` or a configured policy, risky pages are held for review; `llmwiki lint` and `llmwiki eval` check links, citations, freshness, and quality.
4. **Ask and reuse.** Query from the CLI, open the local viewer, serve it over MCP, use the SDK, or export to other formats.

The key shift is moving work from query time to compile time — see [Karpathy's LLM Wiki pattern](#karpathys-llm-wiki-pattern).

## Quick start

```bash
npm install -g llm-wiki-compiler

export ANTHROPIC_API_KEY=sk-...
# or choose another provider:
# export LLMWIKI_PROVIDER=openai
# export OPENAI_API_KEY=sk-...

llmwiki quickstart ./notes.md
llmwiki query "what are the key ideas?"
llmwiki view --open
```

`quickstart` ingests one source, compiles pages, and opens the viewer. Inside an existing project, run `llmwiki next` when you want the safest next action.

To start with a domain model instead of the default concepts-and-queries layout:

```bash
mkdir research-wiki && cd research-wiki
llmwiki template inspect autosci
llmwiki template init autosci
llmwiki profile validate
llmwiki workflow list
```

Template installation is for a new or empty typed project. It materializes the chosen profile into `.llmwiki/profile.json`; normal project loading never depends on a template registry or lockfile.

Detailed setup: [`docs/installation.mdx`](docs/installation.mdx) and [`docs/quickstart.mdx`](docs/quickstart.mdx).

## Demo

![llmwiki demo](docs/images/demo.gif)

Try it on any article or document:

```bash
mkdir my-wiki && cd my-wiki
llmwiki quickstart https://en.wikipedia.org/wiki/Andrej_Karpathy
llmwiki query "What terms did Andrej coin?"
```

The [`examples/basic/`](examples/basic/) directory includes a small pre-generated wiki you can inspect without an API key.

## Configurable Lifecycle Profiles (CLP)

CLP turns llmwiki's knowledge compiler into a reusable substrate for domain-specific knowledge systems. A validated `.llmwiki/profile.json` is the single contract for:

- typed entities, fields, and directed relations;
- lifecycle states, transition evidence, and trust gates;
- multi-stage workflows and declared actions;
- hash-pinned artifacts and first-party connector bindings; and
- content tiers and retrieval behavior.

These rules are enforced by the runtime, not left as prompt conventions. The CLI, SDK, MCP server, viewer, context builder, lint, status, export, and OKF exchange surfaces all operate from the same profile contract. Invalid profiles and writes that bypass a declared gate fail closed.

CLP is backward-compatible by construction: a project without `.llmwiki/profile.json` uses the built-in default concepts-and-queries profile and preserves the pre-1.0 behavior. You can start three ways — scaffold your own profile, install a built-in or local template, or install a signed template from a trusted tap:

```bash
# author your own profile, one entity type at a time
llmwiki profile init research --entity paper

# or install a built-in or local declarative template
llmwiki template list
llmwiki template inspect autosci
llmwiki template init autosci

llmwiki profile validate
llmwiki workflow list
```

`autosci` is a practical research system with papers, ideas, experiments, manuscripts, evidence artifacts, workflows, and Crossref ingestion. `newsroom` applies the same generic machinery to articles, desks, bylines, and editorial workflows. Templates contain configuration and examples, never executable plugin code.

Templates can also be distributed securely. Publishers build signed, offline distributions with `llmwiki template publish` — Ed25519 signing, key rotation, and package revocation — and verify them with `template publish verify`. Consumers add explicitly trusted taps, discover and inspect signed catalogs, and install or update templates with continuity, revocation, and compatibility checks enforced under lock.

Read the [CLP concept guide](docs/concepts/configurable-lifecycle-profiles.mdx), follow the [AutoSci research workflow](docs/guides/autosci-research-workflow.mdx), or explore the [Newsroom editorial workflow](docs/guides/newsroom-editorial-workflow.mdx).

## Karpathy's LLM Wiki pattern

Andrej Karpathy described the LLM Wiki pattern as a way to turn raw material into compiled knowledge that future agents can reuse. llmwiki is a concrete compiler for that pattern.

The key shift is moving work from query time to compile time. Traditional RAG repeatedly retrieves raw chunks and asks the model to reconstruct relationships for each question. llmwiki first turns sources into typed, interlinked pages with citations, metadata, and review state. Queries, context packs, exports, and MCP tools then operate over that compiled artifact.

That makes llmwiki useful when knowledge should compound: concepts shared across sources become one page, saved answers become future context, stale pages can be detected and repaired, and agents can consume a stable evidence pack instead of re-reading the same raw files from scratch.

See [`docs/concepts/karpathy-pattern.mdx`](docs/concepts/karpathy-pattern.mdx) for the deeper explanation.

## Agent decision guide

If an agent is scanning this README, these are the high-signal entry points:

| Goal | Use |
|---|---|
| Create a wiki from one source and inspect it | `llmwiki quickstart <source>` |
| Start a typed research or editorial project | `llmwiki template list`, then `llmwiki template init autosci\|newsroom` |
| Inspect or validate the active domain contract | `llmwiki profile show` and `llmwiki profile validate` |
| Run a declared lifecycle workflow | `llmwiki workflow list`, then `llmwiki workflow start <id>` |
| Write or verify a profile-declared artifact | `llmwiki artifact write ...` and `llmwiki artifact verify <ref>` |
| Import external records through a connector | `llmwiki connector list`, then `llmwiki connector run <id> --input key=value` |
| Add more files or URLs | `llmwiki ingest <url-or-file>` |
| Compile or recompile changed sources | `llmwiki compile` |
| Remove a bad source and the concept pages derived only from it | `llmwiki rm <source>` |
| Hold generated pages for human approval | `llmwiki compile --review` or review policy config |
| Ask grounded questions | `llmwiki query "question"` |
| Save an answer back into the wiki | `llmwiki query "question" --save` |
| Build an evidence pack for another agent | `llmwiki context "<task>" --json` or MCP `get_context_pack` |
| Inspect the compiled knowledge base | `llmwiki view --open` |
| Check broken links, citations, confidence, freshness, and quality | `llmwiki lint` and `llmwiki eval` |
| Repair stale compiled pages | `llmwiki refresh --stale --dry-run`, then `llmwiki refresh --stale` |
| Drive llmwiki from an agent | `llmwiki serve --root <project>` |
| Drive llmwiki from TypeScript | `createWiki({ root })` |
| Export for another system | `llmwiki export --target <format>` |
| Export an Open Knowledge Format bundle | `llmwiki export --target okf --out <dir>` |
| Import an Open Knowledge Format bundle | `llmwiki import --okf <dir> --dry-run`, then review/approve |
## Core commands

| Command | What it does |
|---|---|
| `llmwiki ingest <url-or-file>` | Fetch a URL (web page, Wikipedia, arXiv, YouTube transcript) or read a local file (PDF, image, transcript, markdown, text) into `sources/`. |
| `llmwiki ingest-session <path>` | Import exported Claude, Codex, or Cursor sessions into `sources/`. |
| `llmwiki quickstart <source>` | Ingest, compile, and optionally open the viewer in one step. |
| `llmwiki compile [--review] [--lang <code>] [--concurrency <n>]` | Incrementally extract concepts and generate wiki pages. |
| `llmwiki watch` | Watch `sources/` and recompile when a source is added or changed. |
| `llmwiki recover` | Recover an incomplete compile (revert a crashed compile's journal) without a full recompile. |
| `llmwiki next [--json]` | Show the recommended next action for the project (read-only). |
| `llmwiki rm <source> [--dry-run]` | Delete a source and the concept pages derived exclusively from it; typed entity pages of a non-default profile are left untouched and the command warns about them (unreleased). |
| `llmwiki refresh --stale [--dry-run]` | Recompile changed owners of stale pages and clean selected orphaned ownership. |
| `llmwiki template list\|inspect\|init` | Discover and install validated declarative profile templates. Also `status`, `update`, `search`, `verify`, `tap ...` and `publish ...` for signed template distribution. |
| `llmwiki schema init\|show` | Write or print the page-kind and cross-link schema (`.llmwiki/schema.json`). |
| `llmwiki profile init\|show\|validate\|diff` | Create a minimal profile, inspect it, validate it, or assess profile changes. |
| `llmwiki workflow ...` | Discover and drive profile-declared workflows, stages, gates, and outputs (experimental). |
| `llmwiki artifact write\|verify` | Write trusted profile-declared artifacts and verify hash-pinned references. |
| `llmwiki connector list\|run` | Discover first-party connectors and stage external records for review. |
| `llmwiki review list/show/approve/reject` | Inspect and manage held candidates. |
| `llmwiki query "question" [--save]` | Ask questions against the compiled wiki, optionally saving the answer. |
| `llmwiki context "<prompt>" --json` | Build a citation-aware evidence pack for agents. |
| `llmwiki view [--open]` | Start the read-only local browser viewer. |
| `llmwiki status [--json]` | Report page/source counts, stale and orphaned pages, pending work, and state health. |
| `llmwiki lint` | Validate wiki structure, citations, links, metadata, and freshness. |
| `llmwiki eval [--suite fast\|full]` | Measure wiki quality and optional citation support. Subcommands `report`, `history`, `judgements` and `cache` re-display, trend and manage past results. |
| `llmwiki rules extract\|list\|approve\|reject\|export` | Extract, review and export machine-actionable rule candidates for a downstream rule importer. |
| `llmwiki state reset --yes` | Back up and reset `.llmwiki/state.json` (recovery for a state written by a newer llmwiki version). |
| `llmwiki export [--target <format>]` | Export the wiki to `llms-txt`, `llms-full-txt`, `json`, `json-ld`, `graphml` and `marp` (all of them without `--target`), or to Open Knowledge Format with `--target okf`. |
| `llmwiki import --okf <dir> [--dry-run] [--trusted]` | Import an Open Knowledge Format bundle, staged for review by default. |
| `llmwiki serve --root <dir>` | Start the MCP server. |

Full command docs live in [`docs/cli/`](docs/cli/).

## Open Knowledge Format

llmwiki is an Open Knowledge Format (OKF) producer and consumer. OKF is a Google Cloud initiative for sharing compiled knowledge as portable markdown files with structured frontmatter.

```bash
llmwiki export --target okf --out ./dist/okf
llmwiki import --okf ./dist/okf --dry-run
llmwiki import --okf ./dist/okf
```

A plain `llmwiki export` does not write the OKF bundle; it is produced only with `--target okf`.

OKF import is intentionally review-first: untrusted bundles become review candidates, not live wiki pages. The importer preserves foreign OKF metadata, stores llmwiki provenance under `x-llmwiki`, and re-exports imported pages honestly after local edits, including safe original nested paths.

See [`docs/guides/open-knowledge-format.mdx`](docs/guides/open-knowledge-format.mdx), [`docs/cli/export.mdx`](docs/cli/export.mdx), and [`docs/cli/import.mdx`](docs/cli/import.mdx).

## What llmwiki creates

A project has raw inputs in `sources/`, compiled markdown in `wiki/`, and compiler state under `.llmwiki/`:

```text
sources/
  raw source files
wiki/
  concepts/      compiled pages
  queries/       saved answers
  <entity>/      profile-declared typed pages
  graph/         typed relation and audit-event stores
  outputs/       derived workflow projections
  index.md       generated TOC
.llmwiki/
  profile.json   active domain contract
  template-lock.json  advisory install provenance
  config.json    review policy
  schema.json    page-kind/cross-link policy
  state.json     source hashes and ownership
  candidates/    held review candidates
  workflows/     signed workflow run state
  eval/          quality history and thresholds
artifacts/       hash-pinned profile-declared files and manifests
log.md           activity journal
```

Compiled pages are plain markdown with YAML frontmatter, plus enough metadata for agents to reason about citations, freshness, confidence, contradictions, and review state. See [`docs/concepts/wiki-model.mdx`](docs/concepts/wiki-model.mdx).

## Agent integration

### MCP

Run:

```bash
llmwiki serve --root /path/to/wiki-project
```

MCP clients can ingest sources, compile, query, search pages, read pages, lint, run eval, inspect status, request context packs, and exchange OKF bundles. The tools are `ingest_source`, `compile_wiki`, `query_wiki`, `search_pages`, `read_page`, `lint_wiki`, `wiki_status`, `get_context_pack`, `run_eval`, `verify_artifact`, `export_okf`, `import_okf`, `list_workflow_actions`, `describe_workflow_action`, `run_workflow_action` and `workflow_run_status`, alongside `llmwiki://` resources for the index, sources, state, concept and query pages and the eval report. MCP workflow actions are hard-capped at staged writes: they cannot perform trusted writes or satisfy human gates, and artifacts can be verified but not written over MCP. Read-only tools work without provider credentials; LLM-backed tools validate provider credentials at call time. The `run_eval` tool runs its fast suite without a provider; its full suite (which LLM-judges citation support) requires one.

See [`docs/guides/mcp-agent-integration.mdx`](docs/guides/mcp-agent-integration.mdx).

### SDK

```ts
import { createWiki } from "llm-wiki-compiler";

const wiki = createWiki({ root: "/path/to/wiki-project" });
await wiki.ingest({ source: "./notes.md" });
await wiki.compile();
const answer = await wiki.query({ question: "What changed?" });
```

The core methods cover ingest, compile, query, search, pages, sources, status, lint, context packs, JSON export, eval and OKF import/export. The profile, workflow and artifact methods are marked `@experimental` in the SDK types, with a note that their shape may change in a future minor release.

See [`docs/guides/sdk.mdx`](docs/guides/sdk.mdx).

## Configuration

Minimum requirement: Node.js 24 or newer.

The default provider is Anthropic:

```bash
export ANTHROPIC_API_KEY=sk-...
```

Provider selection is environment-driven:

| Provider | Typical setup |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` |
| Claude Agent SDK | Local Claude Code login, `LLMWIKI_PROVIDER=claude-agent` |
| OpenAI-compatible | `LLMWIKI_PROVIDER=openai`, `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` |
| Ollama | `LLMWIKI_PROVIDER=ollama`, `OLLAMA_HOST` |
| GitHub Copilot | `LLMWIKI_PROVIDER=copilot`, `GITHUB_TOKEN=$(gh auth token)` |
| MiniMax | `LLMWIKI_PROVIDER=minimax`, `MINIMAX_API_KEY` |
| Atlas Cloud (unreleased) | `LLMWIKI_PROVIDER=atlascloud`, `ATLASCLOUD_API_KEY` |

Embeddings come from the active provider where it has an embedding endpoint. `LLMWIKI_EMBEDDING_PROVIDER` (`anthropic`, `claude-agent`, `openai` or `ollama`) selects a separate embedding backend (unreleased). `anthropic` and `claude-agent` embeddings go through Voyage and need `VOYAGE_API_KEY`; Atlas Cloud, MiniMax and GitHub Copilot have no embedding endpoint wired up here. Changing the embedding backend invalidates the embedding index, and the next `llmwiki compile` re-embeds every page. Without embeddings, `context` falls back to lexical ranking, while `query` falls back to asking the model to pick pages from the list of live pages (an extra provider call, not a lexical search).

See [`docs/configuration/providers.mdx`](docs/configuration/providers.mdx) and [`docs/configuration/environment-variables.mdx`](docs/configuration/environment-variables.mdx).

## Quality and safety model

llmwiki is designed for auditable generated knowledge:

- **Review before write.** Use `compile --review` or `.llmwiki/config.json` review policy to hold risky pages as candidates.
- **Profile floors are runtime checks.** Field contracts, lifecycle transitions, relation counts, evidence, and artifact requirements are enforced across page, lifecycle, workflow, import, and approval write surfaces.
- **External connector data is untrusted.** First-party connectors use confined fetches and stage fenced review candidates; approval is pinned to the exact body the operator reviewed.
- **Artifacts are content-addressed evidence.** Artifact reads and writes are path-confined, size-capped, schema-checked, and verified against hash-pinned references.
- **Fail-closed config.** Invalid review-policy config aborts compile instead of silently disabling review.
- **Source confinement.** Source snippets and import/export paths are confined to the project.
- **Freshness is explicit.** Pages can be fresh, stale, orphaned, or unverified; stale pages are flagged and repairable. The JSON export is active-page-only: it carries freshness for live pages (`fresh`/`stale`/`unverified`); computed-orphaned pages (all sources deleted) surface only as lint and viewer signals and are dropped from the export.
- **Imported compiled knowledge is staged by default.** External bundles go through the review queue unless explicitly trusted.
- **CI gates are supported.** `llmwiki lint` and `llmwiki eval` can enforce quality thresholds.

See [`docs/configuration/review-policy.mdx`](docs/configuration/review-policy.mdx), [`docs/troubleshooting/stale-pages.mdx`](docs/troubleshooting/stale-pages.mdx), and [`docs/guides/ci-quality-gates.mdx`](docs/guides/ci-quality-gates.mdx).

## Scale and what works

llmwiki is still early software, but it is no longer a toy pipeline for a handful of notes.

- **Incremental compilation** means unchanged sources do not flow back through the LLM.
- **Parallel compile** runs concept extraction and page generation concurrently under a configurable cap (`--concurrency` / `LLMWIKI_COMPILE_CONCURRENCY`), cutting wall-clock on large compiles.
- **Chunk-level embeddings** narrow large wikis before BM25 reranking in `query` and graph expansion in `context`.
- **Content-hash-aware embedding updates** avoid recomputing vectors for unchanged pages and chunks.
- **Batch embedding** sends page and chunk vectors to the provider in batches rather than one request at a time, cutting latency on cold starts and large refreshes.
- **Cached citation judgements** make repeated `eval --suite full` runs cheaper.
- **Fallback without embeddings** keeps query and context usable when the active provider has no embedding endpoint: `context` ranks lexically, `query` has the model pick pages.
- **Prompt budgeting and ingest truncation metadata** make large sources explicit instead of silently pretending they fit.

The current sweet spot is a durable project or domain wiki: research folders, codebase docs, team handbooks, standards, design notes, decision logs, or curated source packs. The less ideal fit is a high-churn firehose where raw search is enough and compiled structure would go stale faster than it can be reviewed.

## Status and known limits

llmwiki is early software, published to npm at 1.1.0. This fork's `main` may differ from that release, so check [`CHANGELOG.md`](CHANGELOG.md).

- **Experimental surfaces.** The `workflow` command group is labelled experimental in the CLI help. The SDK's profile, workflow and artifact methods are marked `@experimental` and may change shape in a minor release.
- **Unreleased on `main`.** `llmwiki rm`, the Atlas Cloud provider and `LLMWIKI_EMBEDDING_PROVIDER` are listed under *Unreleased* in the changelog.
- **Runtime.** Node.js 24 or newer.
- **The provider sees your sources.** `compile`, `query` and the other LLM-backed steps send content to the provider you configure. Ingested content longer than 100,000 characters is truncated, and the saved file records that it is partial.
- **Embeddings depend on the provider.** MiniMax, GitHub Copilot and Atlas Cloud expose no embedding endpoint here; route embeddings elsewhere with `LLMWIKI_EMBEDDING_PROVIDER`, or `context` falls back to lexical ranking and `query` to an LLM page pick.
- **Review is off by default.** With no `--review` and no review policy, every generated page is written live. `llmwiki query --save` is not gated by the review policy.
- **Freshness costs time.** `status` computes freshness by re-hashing sources, so its runtime grows with the size of `sources/`.
- **CI thresholds.** `citation_support_mean` in `.llmwiki/eval/thresholds.yaml` is only evaluated by the full eval suite.
- **Where it fits.** A durable project or domain wiki; less so a high-churn firehose where raw search is enough and compiled structure would go stale faster than it can be reviewed.

## Documentation

The full docs site source is in [`docs/`](docs/):

- Start here: [`docs/introduction.mdx`](docs/introduction.mdx)
- Quickstart: [`docs/quickstart.mdx`](docs/quickstart.mdx)
- Installation: [`docs/installation.mdx`](docs/installation.mdx)
- Karpathy's LLM Wiki pattern: [`docs/concepts/karpathy-pattern.mdx`](docs/concepts/karpathy-pattern.mdx)
- How the compiler works: [`docs/concepts/how-it-works.mdx`](docs/concepts/how-it-works.mdx)
- Wiki model: [`docs/concepts/wiki-model.mdx`](docs/concepts/wiki-model.mdx)
- Configurable Lifecycle Profiles: [`docs/concepts/configurable-lifecycle-profiles.mdx`](docs/concepts/configurable-lifecycle-profiles.mdx)
- AutoSci research workflow: [`docs/guides/autosci-research-workflow.mdx`](docs/guides/autosci-research-workflow.mdx)
- Newsroom editorial workflow: [`docs/guides/newsroom-editorial-workflow.mdx`](docs/guides/newsroom-editorial-workflow.mdx)
- Profile templates: [`docs/configuration/profile-templates.mdx`](docs/configuration/profile-templates.mdx)
- CLI reference: [`docs/cli/`](docs/cli/)
- Open Knowledge Format: [`docs/guides/open-knowledge-format.mdx`](docs/guides/open-knowledge-format.mdx)
- MCP integration: [`docs/guides/mcp-agent-integration.mdx`](docs/guides/mcp-agent-integration.mdx)
- SDK: [`docs/guides/sdk.mdx`](docs/guides/sdk.mdx)
- Atomic Memory bridge: [`docs/guides/atomic-memory-bridge.mdx`](docs/guides/atomic-memory-bridge.mdx)
- Providers and environment variables: [`docs/configuration/providers.mdx`](docs/configuration/providers.mdx), [`docs/configuration/environment-variables.mdx`](docs/configuration/environment-variables.mdx)
- Review policy and CI quality gates: [`docs/configuration/review-policy.mdx`](docs/configuration/review-policy.mdx), [`docs/guides/ci-quality-gates.mdx`](docs/guides/ci-quality-gates.mdx)
- Troubleshooting: [`docs/troubleshooting/faq.mdx`](docs/troubleshooting/faq.mdx), [`docs/troubleshooting/stale-pages.mdx`](docs/troubleshooting/stale-pages.mdx), [`docs/troubleshooting/state-recovery.mdx`](docs/troubleshooting/state-recovery.mdx)

Preview the docs locally with Node 24:

```bash
cd docs
volta run --node 24 npx mint dev --port 3001
```

## Current release

**Released `1.1.0`:**

- Template distribution ecosystem: publishers author signed, offline distributions with `template publish init | add | build | rotate | revoke` (Ed25519 signing, key rotation, package revocation) and verify them with `template publish verify`.
- Consumers configure explicitly trusted template taps, discover and inspect signed catalogs, and install or update templates with continuity, revocation, and compatibility checks under lock.
- `llmwiki status` command: a readable snapshot of page and source counts, last compile, stale and orphaned pages, pending changes, the review queue, active profile, and state-file health.

**Released `1.0.0`:**

- Configurable Lifecycle Profiles across CLI, SDK, MCP, viewer, context, lint, status, export, and profile-aware OKF exchange.
- Built-in `autosci` and `newsroom` templates, typed workflows and actions, first-class artifacts, typed relations and runtime lifecycle gates, plus a hardened first-party connector substrate with Crossref.
- Typed-page semantic search and retrieval controls, batch embeddings, parallel compile, and fail-closed state recovery.

See [`CHANGELOG.md`](CHANGELOG.md) for release history.

## Companion: Atomic Memory

llmwiki and [Atomic Memory](https://github.com/atomicstrata/atomicmemory) are complementary open context infrastructure:

- **llmwiki** compiles source material into durable, inspectable knowledge.
- **Atomic Memory** gives agents runtime memory that is searchable, scoped, correctable, and inspectable.

Use them independently or together. The [`@atomicmemory/llmwiki`](https://github.com/atomicstrata/atomicmemory/tree/main/packages/llmwiki) bridge imports `llmwiki export --target json --project-id <id>` as durable memory records.

## Contributing

Contributions are welcome. If llmwiki is missing something you need, open an issue or PR and describe the workflow you are trying to support - need-driven improvements are often the best ones. If you want to contribute more generally, roadmap items are a good place to start. For larger changes to core compile, review, import/export, or retrieval semantics, please start with an issue or design discussion so we can align on the contract first.

Before committing code changes, run:

```bash
npx tsc --noEmit
npm run build
npm test
npm run fallow:ci
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE) (Copyright (c) 2026 atomicmemory, as stated in the license file). This fork keeps the upstream license and credits unchanged.

## Disclaimer

No LLMs were harmed in the making of this repo.
