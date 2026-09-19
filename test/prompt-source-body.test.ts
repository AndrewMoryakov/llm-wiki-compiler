/**
 * The model sees a source's body, never its frontmatter, and the line numbers it
 * sees are the source file's own.
 *
 * Frontmatter is metadata written by whatever produced the source (a connector,
 * a glue script), not evidence. Shown to the model, it gets cited — a citation
 * like `^[doc.md:2-5]` pointing at `title:`/`source:` lines — and extracted as
 * concepts about the header rather than the document. Hiding it must not shift
 * the numbering, though: provenance, eval and the broken-citation linter all read
 * a cited range as whole-file lines (`raw.split("\n").slice(start - 1, end)`), so
 * the first body line keeps its whole-file number.
 */

import { describe, it, expect, vi } from "vitest";
import { compileAndReport } from "../src/compiler/index.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import {
  budgetAndNumberSource,
  buildBudgetedCombinedContent,
} from "../src/compiler/prompt-budget.js";
import { useCompileProject } from "./fixtures/compile-project.js";

const HEADER_MARKER = "HEADER-ONLY-MARKER-5d0e";
const HEADER = `---\ntitle: ${HEADER_MARKER}\nsource: x\ningestedAt: 2026-01-01\nsourceType: text\n---\n`;
const RAW = `${HEADER}first body line\nsecond body line`;
const NUMBERED_LINE = /^\s*(\d+) \| (.*)$/;

/** Every `N | text` line of a numbered rendering, as [N, text] pairs. */
function numberedLines(rendered: string): Array<[number, string]> {
  return rendered.split("\n").flatMap((line) => {
    const match = NUMBERED_LINE.exec(line);
    return match ? [[Number(match[1]), match[2]] as [number, string]] : [];
  });
}

describe("numbered source text", () => {
  it("omits the frontmatter from a single numbered source", () => {
    const numbered = budgetAndNumberSource("doc.md", RAW);
    expect(numbered).not.toContain(HEADER_MARKER);
    expect(numbered).not.toContain("sourceType");
  });

  it("omits the frontmatter from combined page-generation content", () => {
    const combined = buildBudgetedCombinedContent("Concept", [{ file: "doc.md", content: RAW }]);
    expect(combined).not.toContain(HEADER_MARKER);
    expect(combined).toContain("--- SOURCE: doc.md ---");
  });

  it("numbers each shown line as the same line of the whole file", () => {
    const fileLines = RAW.split("\n");
    const shown = numberedLines(budgetAndNumberSource("doc.md", RAW));
    expect(shown[0]).toEqual([7, "first body line"]);
    for (const [lineNumber, text] of shown) expect(fileLines[lineNumber - 1]).toBe(text);
  });

  it("numbers a source without frontmatter from line 1", () => {
    expect(numberedLines(budgetAndNumberSource("doc.md", "only\nlines"))[0]).toEqual([1, "only"]);
  });
});

describe("compile prompts", () => {
  const ctx = useCompileProject({ dirSuffix: "source-body", sourceFile: "doc.md", sourceContent: RAW });

  it("never send the frontmatter to the model", async () => {
    const toolCall = vi
      .spyOn(AnthropicProvider.prototype, "toolCall")
      .mockResolvedValue(JSON.stringify({ concepts: [{ concept: "Body Topic", summary: "S.", is_new: true }] }));
    const complete = vi
      .spyOn(AnthropicProvider.prototype, "complete")
      .mockResolvedValue("The body topic. ^[doc.md:7]");

    await compileAndReport(ctx.dir);

    const prompts = [...toolCall.mock.calls, ...complete.mock.calls].map(([system]) => system);
    expect(complete.mock.calls.length).toBeGreaterThan(0);
    for (const system of prompts) expect(system).not.toContain(HEADER_MARKER);
    expect(prompts.join("\n")).toContain("first body line");
  });
});
