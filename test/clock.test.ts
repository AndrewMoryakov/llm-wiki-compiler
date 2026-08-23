import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isClockFrozen, now, nowIso } from "../src/utils/clock.js";
import { generateIndex } from "../src/compiler/indexgen.js";
import { INDEX_FILE } from "../src/utils/constants.js";

describe("compile clock", () => {
  const original = process.env.SOURCE_DATE_EPOCH;

  beforeEach(() => { delete process.env.SOURCE_DATE_EPOCH; });
  afterEach(() => {
    if (original === undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH = original;
  });

  it("freezes output timestamps when the epoch is set", () => {
    process.env.SOURCE_DATE_EPOCH = "1700000000";

    expect(isClockFrozen()).toBe(true);
    expect(nowIso()).toBe("2023-11-14T22:13:20.000Z");
    // The point of the whole exercise: two reads are the same value, so two
    // compiles of the same inputs render the same bytes.
    expect(nowIso()).toBe(nowIso());
  });

  it("uses the real clock when the epoch is unset", () => {
    expect(isClockFrozen()).toBe(false);
    const before = Date.now();
    const observed = now().getTime();

    expect(observed).toBeGreaterThanOrEqual(before);
    expect(observed).toBeLessThanOrEqual(Date.now());
  });

  it("ignores a malformed epoch rather than failing the compile", () => {
    // An unrelated tool exporting something odd must not stop a build; falling
    // back to the real clock is visible through isClockFrozen.
    for (const value of ["not-a-number", "-1", "12.5", ""]) {
      process.env.SOURCE_DATE_EPOCH = value;
      expect(isClockFrozen()).toBe(false);
    }
  });
});

describe("compile output is reproducible under a frozen clock", () => {
  const original = process.env.SOURCE_DATE_EPOCH;
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "llmwiki-clock-"));
    mkdirSync(join(root, "wiki", "concepts"), { recursive: true });
    writeFileSync(
      join(root, "wiki", "concepts", "rust.md"),
      "---\ntitle: Rust\nsummary: A language\n---\n\nBody.\n",
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (original === undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH = original;
  });

  it("renders the index byte-identically across runs", async () => {
    process.env.SOURCE_DATE_EPOCH = "1700000000";
    const indexPath = join(root, INDEX_FILE);

    await generateIndex(root);
    const first = readFileSync(indexPath);
    await generateIndex(root);
    const second = readFileSync(indexPath);

    expect(second.equals(first)).toBe(true);
    // The footer is where the clock used to leak into page text, under a comment
    // asking for that footer to stay byte-identical.
    expect(first.toString()).toContain("Generated 2023-11-14T22:13:20.000Z");
  });

  it("still differs across runs when the clock is not frozen", async () => {
    delete process.env.SOURCE_DATE_EPOCH;
    const indexPath = join(root, INDEX_FILE);

    await generateIndex(root);
    const first = readFileSync(indexPath).toString();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await generateIndex(root);
    const second = readFileSync(indexPath).toString();

    // Not a defect: an interactive run should record when it happened. This
    // asserts the freeze is what makes the difference, so the test above cannot
    // pass for some unrelated reason.
    expect(second).not.toBe(first);
  });
});
