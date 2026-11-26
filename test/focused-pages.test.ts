import { afterEach, describe, expect, it } from "vitest";
import { buildPagePrompt, FOCUSED_PAGES_ENV, focusedPagesEnabled } from "../src/compiler/prompts.js";

describe("focused pages", () => {
  afterEach(() => {
    delete process.env[FOCUSED_PAGES_ENV];
  });

  it("is off by default and leaves the page prompt as it was", () => {
    expect(focusedPagesEnabled()).toBe(false);
    const plain = buildPagePrompt("Docling", "body", "", "");
    expect(buildPagePrompt("Docling", "body", "", "", false)).toBe(plain);
    expect(plain).not.toContain("is about \"Docling\" only");
  });

  it("asks for a page about the concept only when on", () => {
    process.env[FOCUSED_PAGES_ENV] = "1";
    expect(focusedPagesEnabled()).toBe(true);
    const focused = buildPagePrompt("Docling", "body", "", "", true);
    expect(focused).toContain("This page is about \"Docling\" only.");
    expect(focused).toContain("link them with [[wikilinks]] instead of");
    expect(focused.indexOf("only.")).toBeLessThan(focused.indexOf("--- SOURCE MATERIAL ---"));
  });
});
