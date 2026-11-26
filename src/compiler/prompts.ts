/**
 * LLM prompt templates and tool schemas for the compilation pipeline.
 * Contains the Anthropic tool definition for concept extraction,
 * prompt builders for both extraction and page generation phases,
 * and a parser for the structured tool output.
 */

import type {
  ContradictionRef,
  ExtractedConcept,
  ProvenanceState,
} from "../utils/types.js";
import type { PageKindRule, SeedPage } from "../schema/index.js";
import { languageDirective } from "../utils/output-language.js";

/**
 * Build a list of optional prompt lines, omitting empty entries so the
 * default-case prompt is byte-identical to the previous version. Used by
 * the prompt builders to splice in the output-language directive only
 * when the user opted in.
 */
function withLangLine(...lines: string[]): string[] {
  const lang = languageDirective();
  return lang ? [...lines, lang] : lines;
}

/**
 * Named version of the extraction + page-generation prompt contract.
 *
 * Bump this whenever the wording of the extraction tool schema, the
 * extraction system prompt, or the page-generation prompt changes in a way
 * that could alter compiled page content. The export provenance stamp
 * (`promptVersion` in the JSON export envelope) carries this value so a
 * downstream auditor can distinguish pages produced under different prompt
 * generations even when the model id is identical. Format is `vMAJOR`.
 */
export const PROMPT_VERSION = "v1";

/**
 * Environment switch for target pages. When it is "1", the extraction tool
 * gains an `updates` field and the prompt asks the model to name, for a concept
 * whose subject an existing page is about, that page's slug from the index. Off by
 * default: the schema and the prompt are then byte-identical to before.
 */
export const TARGET_PAGES_ENV = "LLMWIKI_TARGET_PAGES";

/**
 * Environment switch for focused pages. When it is "1", the page prompt says the
 * page is about its concept only: the source's other topics have their own pages
 * and are linked, not retold. Off by default: the prompt is then byte-identical.
 */
export const FOCUSED_PAGES_ENV = "LLMWIKI_FOCUSED_PAGES";

/** True when focused pages are switched on for this process. */
export function focusedPagesEnabled(): boolean {
  return process.env[FOCUSED_PAGES_ENV] === "1";
}

/** True when target pages are switched on for this process. */
export function targetPagesEnabled(): boolean {
  return process.env[TARGET_PAGES_ENV] === "1";
}

/** Allowed provenance state strings emitted by the LLM tool schema. */
const PROVENANCE_STATE_VALUES: ProvenanceState[] = [
  "extracted",
  "merged",
  "inferred",
  "ambiguous",
];

/**
 * Anthropic Tool definition for extracting knowledge concepts from a source.
 * Used with callClaude's tool_use mode to get structured concept data.
 */
export const CONCEPT_EXTRACTION_TOOL = {
  name: "extract_concepts",
  description: "Extract knowledge concepts from a source document",
  input_schema: {
    type: "object" as const,
    properties: {
      concepts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            concept: {
              type: "string",
              description: "Human-readable concept title",
            },
            summary: {
              type: "string",
              description: "One-line description",
            },
            is_new: {
              type: "boolean",
              description: "True if this is a new concept not in existing wiki",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description:
                "2-4 categorical tags for organizing this concept (e.g., 'machine-learning', 'optimization')",
            },
            confidence: {
              type: "number",
              description:
                "Confidence in this concept on a 0..1 scale (1 = directly stated, 0 = highly speculative).",
            },
            provenance_state: {
              type: "string",
              enum: PROVENANCE_STATE_VALUES,
              description:
                "How this concept was produced: 'extracted' (direct from source), 'merged' (synthesised across sources), 'inferred' (model deduction), or 'ambiguous' (sources disagree).",
            },
            contradicted_by: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string", description: "Slug of the contradicting concept." },
                  reason: { type: "string", description: "Brief reason for the contradiction." },
                },
                required: ["slug"],
              },
              description: "Slugs of other concepts whose evidence contradicts this one.",
            },
          },
          required: ["concept", "summary", "is_new"],
        },
      },
    },
    required: ["concepts"],
  },
};

/**
 * Build the system prompt for the concept extraction phase.
 * Instructs the LLM to analyze a source document and identify distinct concepts.
 * @param sourceContent - The full text of the source document.
 * @param existingIndex - The current wiki index.md contents (may be empty).
 * @returns System prompt string for the extraction call.
 */
export function buildExtractionPrompt(
  sourceContent: string,
  existingIndex: string,
  targetPages = false,
): string {
  const indexSection = existingIndex
    ? `\n\nHere is the existing wiki index — avoid duplicating concepts already covered:\n\n${existingIndex}`
    : "\n\nNo existing wiki pages yet.";
  const targetSection = targetPages && existingIndex
    ? [
      "",
      "A concept belongs on a page of this index when it is about that page's own",
      "subject, so that a reader of the page would expect to find it there: it adds to,",
      "updates, corrects or narrows what the page is about, even when the page does not",
      "mention this detail yet. For such a concept, set `updates` to that page's slug,",
      "copied exactly as it stands inside [[...]] before the | sign, and set is_new to",
      "false. A concept that is only related to a page, uses one of its terms or shares",
      "its general area does not belong on it; leave `updates` empty for it.",
    ].join("\n")
    : "";

  return [
    ...withLangLine(
      "You are a knowledge extraction engine. Analyze the following source document",
      "and identify 3-8 distinct, meaningful concepts worth documenting as wiki pages.",
      "Each concept should be a standalone topic that someone might look up.",
      "Focus on key ideas, techniques, patterns, or entities — not trivial details.",
      "Use the extract_concepts tool to return your findings.",
    ),
    "",
    "For every concept, emit provenance metadata so downstream tools can reason",
    "about reliability:",
    "  - confidence: 0..1 — how certain you are the source supports this concept.",
    "  - provenance_state: 'extracted' if directly stated, 'merged' if synthesised",
    "    from multiple parts of the source, 'inferred' if reasoned from context,",
    "    or 'ambiguous' if the source is contradictory or unclear.",
    "  - contradicted_by: slugs of other concepts (in this batch or the index)",
    "    whose evidence conflicts with this one.",
    indexSection + targetSection,
    "\n\n--- SOURCE DOCUMENT ---\n\n",
    sourceContent,
  ].join("\n");
}

/**
 * Build the system prompt for wiki page generation.
 * Instructs the LLM to write a complete wiki page for a single concept.
 * @param concept - The concept title to write about.
 * @param sourceContent - The source material to draw from.
 * @param existingPage - The current page content if updating (empty for new pages).
 * @param relatedPages - Concatenated content of related wiki pages for context.
 * @returns System prompt string for the page generation call.
 */
export function buildPagePrompt(
  concept: string,
  sourceContent: string,
  existingPage: string,
  relatedPages: string,
  focused: boolean = false,
): string {
  const existingSection = existingPage
    ? `\n\nExisting page to update:\n\n${existingPage}`
    : "";

  const relatedSection = relatedPages
    ? `\n\nRelated wiki pages for cross-referencing:\n\n${relatedPages}`
    : "";

  const focusSection = focused
    ? [
      "",
      `This page is about "${concept}" only. Use only the parts of the source that are about it.`,
      "The source's other topics have their own pages: link them with [[wikilinks]] instead of",
      "retelling them, and do not retell the source's introduction, story or background.",
      "Write as much as this concept needs and no more.",
    ].join("\n")
    : "";

  return [
    ...withLangLine(
      `You are a wiki author. Write a clear, well-structured markdown page about "${concept}".`,
      "Draw facts only from the provided source material.",
      "Include a ## Sources section at the end listing the source document.",
      "Suggest [[wikilinks]] to related concepts where appropriate.",
      "Write in a neutral, informative tone. Be concise but thorough.",
    ),
    ...(focused ? [focusSection] : []),
    "",
    "Source attribution: at the end of each prose paragraph, append a citation",
    "marker identifying which source file(s) and line range the paragraph drew from.",
    "PREFERRED format: ^[filename.md:START-END] where START and END are the line numbers",
    "shown in the numbered source content below (e.g. ' 42 | some text' → line 42).",
    "Use this whenever you can identify the specific numbered lines supporting the claim.",
    "Fallback format: ^[filename.md] when the claim draws from the source broadly and",
    "no specific line range applies. For multi-source paragraphs: ^[a.md:1-5, b.md:10-12].",
    "Place citations only at the end of prose paragraphs or sentences — not on",
    "headings, list items, or code blocks.",
    "Do not cite YAML frontmatter lines (the --- ... --- block at the top of a file) as",
    "source evidence for substantive claims — those lines are metadata, not content.",
    "If a claim relates to a metadata field (e.g. document date or author), leave it uncited.",
    "Source filenames are visible as `--- SOURCE: filename.md ---` headers in the content below.",
    "",
    "If a paragraph is your inference rather than a direct extraction, leave it",
    "uncited — downstream lint rules will count uncited paragraphs as 'inferred'",
    "so lint can surface excess-inferred-paragraphs warnings on review.",
    existingSection,
    relatedSection,
    "\n\n--- SOURCE MATERIAL ---\n\n",
    sourceContent,
  ].join("\n");
}

/** Raw concept shape as it arrives from the tool JSON. */
interface RawConcept {
  concept: unknown;
  summary: unknown;
  is_new: unknown;
  tags?: unknown;
  confidence?: unknown;
  provenance_state?: unknown;
  contradicted_by?: unknown;
  updates?: unknown;
}

/** True if the raw concept has the required string/boolean fields. */
function isValidRawConcept(c: RawConcept): boolean {
  return (
    typeof c.concept === "string" &&
    typeof c.summary === "string" &&
    typeof c.is_new === "boolean" &&
    (c.tags === undefined || Array.isArray(c.tags))
  );
}

/** Coerce raw contradiction entries from the tool into typed refs. */
function coerceContradictedBy(raw: unknown): ContradictionRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const refs: ContradictionRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as { slug?: unknown; reason?: unknown };
    if (typeof obj.slug !== "string" || obj.slug.trim().length === 0) continue;
    const ref: ContradictionRef = { slug: obj.slug.trim() };
    if (typeof obj.reason === "string") ref.reason = obj.reason;
    refs.push(ref);
  }
  return refs.length > 0 ? refs : undefined;
}

/** Map a validated raw concept into an ExtractedConcept. */
function mapRawConcept(c: RawConcept): ExtractedConcept {
  const provenance = typeof c.provenance_state === "string" &&
    PROVENANCE_STATE_VALUES.includes(c.provenance_state as ProvenanceState)
    ? (c.provenance_state as ProvenanceState)
    : undefined;
  return {
    concept: c.concept as string,
    summary: c.summary as string,
    is_new: c.is_new as boolean,
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : undefined,
    confidence: typeof c.confidence === "number" ? c.confidence : undefined,
    provenanceState: provenance,
    contradictedBy: coerceContradictedBy(c.contradicted_by),
    ...(typeof c.updates === "string" && c.updates.trim().length > 0 ? { updates: c.updates.trim() } : {}),
  };
}

/**
 * The extraction tool for this run: the plain tool, or with target pages on,
 * a copy whose concepts also carry `updates`.
 */
export function conceptExtractionTool(targetPages: boolean): typeof CONCEPT_EXTRACTION_TOOL {
  if (!targetPages) return CONCEPT_EXTRACTION_TOOL;
  const items = CONCEPT_EXTRACTION_TOOL.input_schema.properties.concepts.items;
  return {
    ...CONCEPT_EXTRACTION_TOOL,
    input_schema: {
      ...CONCEPT_EXTRACTION_TOOL.input_schema,
      properties: {
        concepts: {
          ...CONCEPT_EXTRACTION_TOOL.input_schema.properties.concepts,
          items: {
            ...items,
            properties: {
              ...items.properties,
              updates: {
                type: "string",
                description:
                  "Slug of the existing wiki page whose own subject this concept is about, copied exactly from the index; empty when the concept is only related to a page.",
              },
            },
          },
        },
      },
    },
  } as typeof CONCEPT_EXTRACTION_TOOL;
}

/** Slugs the wiki index links to, as `[[slug|Title]]` or `[[slug]]`. */
export function indexSlugs(existingIndex: string): Set<string> {
  const slugs = new Set<string>();
  for (const match of existingIndex.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    slugs.add(match[1].trim());
  }
  return slugs;
}

/**
 * Keep each concept's `updates` only when it names a page the index lists.
 * Returns the concepts with invalid targets cleared and the targets dropped,
 * so the caller can say so. With target pages off every `updates` is cleared.
 */
export function resolveTargetPages(
  concepts: ExtractedConcept[],
  existingIndex: string,
  targetPages: boolean,
): { concepts: ExtractedConcept[]; dropped: Array<{ concept: string; updates: string }> } {
  const live = targetPages ? indexSlugs(existingIndex) : new Set<string>();
  const dropped: Array<{ concept: string; updates: string }> = [];
  const resolved = concepts.map((c) => {
    if (c.updates === undefined) return c;
    if (live.has(c.updates)) return c;
    if (targetPages) dropped.push({ concept: c.concept, updates: c.updates });
    const { updates: _dropped, ...rest } = c;
    return rest;
  });
  return { concepts: resolved, dropped };
}

/**
 * Build a system prompt for generating a seed page (overview / comparison /
 * entity) declared in the project's schema config. Seed pages weave together
 * material from related concept pages rather than from raw source files.
 * @param seed - Seed page definition pulled from the schema.
 * @param rule - Per-kind rule (used for the description and link minimum).
 * @param relatedPagesContent - Concatenated content of related concept pages.
 * @returns System prompt string for the page generation call.
 */
export function buildSeedPagePrompt(
  seed: SeedPage,
  rule: PageKindRule,
  relatedPagesContent: string,
): string {
  const minLinks = rule.minWikilinks;
  const linkExpectation = minLinks > 0
    ? `Include at least ${minLinks} [[wikilinks]] to related pages.`
    : "Use [[wikilinks]] when referencing other pages.";
  return [
    ...withLangLine(
      `You are a wiki author. Write a ${seed.kind} page titled "${seed.title}".`,
      `Page-kind guidance: ${rule.description}`,
      `Summary line for context: ${seed.summary}`,
      "Draw facts only from the related wiki pages provided below.",
      linkExpectation,
      "Write in a neutral, informative tone. Be concise but thorough.",
    ),
    "\n\n--- RELATED PAGES ---\n\n",
    relatedPagesContent,
  ].join("\n");
}

/**
 * Parse the JSON tool output from concept extraction into typed objects.
 * @param toolOutput - Raw JSON string returned from the extract_concepts tool.
 * @returns Array of ExtractedConcept objects.
 */
export function parseConcepts(toolOutput: string): ExtractedConcept[] {
  try {
    const parsed = JSON.parse(toolOutput);
    let concepts: unknown = parsed.concepts ?? [];
    if (typeof concepts === "string") {
      concepts = JSON.parse(concepts);
    }
    if (!Array.isArray(concepts)) return [];
    return concepts.filter(isValidRawConcept).map(mapRawConcept);
  } catch {
    return [];
  }
}
