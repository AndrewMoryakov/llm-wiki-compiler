import { afterEach, describe, expect, it } from "vitest";
import {
  CONCEPT_EXTRACTION_TOOL,
  TARGET_PAGES_ENV,
  buildExtractionPrompt,
  conceptExtractionTool,
  indexSlugs,
  parseConcepts,
  resolveTargetPages,
  targetPagesEnabled,
} from "../src/compiler/prompts.js";
import { addProvenanceMeta } from "../src/compiler/provenance.js";

const INDEX = [
  "# Knowledge Wiki",
  "",
  "## Concepts",
  "",
  "- **[[best-of-n-как-базовый-уровень-сравнения|Best-of-N как базовый уровень сравнения]]** — summary",
  "- **[[падение-точности-извлечения-к-концу-списка|Падение точности извлечения к концу списка]]** — summary",
].join("\n");

describe("target pages", () => {
  afterEach(() => {
    delete process.env[TARGET_PAGES_ENV];
  });

  it("is off unless the switch is exactly 1", () => {
    expect(targetPagesEnabled()).toBe(false);
    process.env[TARGET_PAGES_ENV] = "true";
    expect(targetPagesEnabled()).toBe(false);
    process.env[TARGET_PAGES_ENV] = "1";
    expect(targetPagesEnabled()).toBe(true);
  });

  it("leaves the tool and the prompt byte-identical when off", () => {
    expect(conceptExtractionTool(false)).toBe(CONCEPT_EXTRACTION_TOOL);
    expect(buildExtractionPrompt("body", INDEX, false)).toBe(buildExtractionPrompt("body", INDEX));
    expect(JSON.stringify(CONCEPT_EXTRACTION_TOOL)).not.toContain("updates");
  });

  it("adds the field and the instruction when on, and only the instruction needs an index", () => {
    const tool = conceptExtractionTool(true);
    expect(Object.keys(tool.input_schema.properties.concepts.items.properties)).toContain("updates");
    expect(tool.input_schema.properties.concepts.items.required).toEqual(["concept", "summary", "is_new"]);
    expect(buildExtractionPrompt("body", INDEX, true)).toContain("`updates` to that page's slug");
    expect(buildExtractionPrompt("body", "", true)).toBe(buildExtractionPrompt("body", ""));
  });

  it("reads the slugs the index links to", () => {
    expect([...indexSlugs(INDEX)]).toEqual([
      "best-of-n-как-базовый-уровень-сравнения",
      "падение-точности-извлечения-к-концу-списка",
    ]);
    expect([...indexSlugs("[[plain-slug]] and [[x|y]]")]).toEqual(["plain-slug", "x"]);
  });

  it("parses updates, and omits the key when the model leaves it empty", () => {
    const concepts = parseConcepts(JSON.stringify({ concepts: [
      { concept: "A", summary: "s", is_new: false, updates: " best-of-n-как-базовый-уровень-сравнения " },
      { concept: "B", summary: "s", is_new: true, updates: "" },
      { concept: "C", summary: "s", is_new: true },
    ] }));
    expect(concepts[0].updates).toBe("best-of-n-как-базовый-уровень-сравнения");
    expect("updates" in concepts[1]).toBe(false);
    expect("updates" in concepts[2]).toBe(false);
  });

  it("keeps a target the index lists and drops any other", () => {
    const { concepts, dropped } = resolveTargetPages([
      { concept: "A", summary: "s", is_new: false, updates: "best-of-n-как-базовый-уровень-сравнения" },
      { concept: "B", summary: "s", is_new: false, updates: "best-of-n" },
      { concept: "C", summary: "s", is_new: true },
    ], INDEX, true);
    expect(concepts[0].updates).toBe("best-of-n-как-базовый-уровень-сравнения");
    expect("updates" in concepts[1]).toBe(false);
    expect(dropped).toEqual([{ concept: "B", updates: "best-of-n" }]);
    expect(concepts[2]).toEqual({ concept: "C", summary: "s", is_new: true });
  });

  it("clears every target when off, without reporting", () => {
    const { concepts, dropped } = resolveTargetPages([
      { concept: "A", summary: "s", is_new: false, updates: "best-of-n-как-базовый-уровень-сравнения" },
    ], INDEX, false);
    expect("updates" in concepts[0]).toBe(false);
    expect(dropped).toEqual([]);
  });

  it("writes the target into the page frontmatter fields", () => {
    const fields: Record<string, unknown> = {};
    addProvenanceMeta(fields, { concept: "A", summary: "s", is_new: false, updates: "x" });
    expect(fields.updates).toBe("x");
    const none: Record<string, unknown> = {};
    addProvenanceMeta(none, { concept: "A", summary: "s", is_new: true });
    expect("updates" in none).toBe(false);
  });
});
