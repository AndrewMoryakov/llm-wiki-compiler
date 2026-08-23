/**
 * A compile must be reproducible: the same sources, compiled against the same
 * model responses, must produce the same bytes.
 *
 * Without that the sandbox split Fenius needs is impossible to verify — a
 * recorded pass and a replayed pass would differ for reasons that have nothing
 * to do with the model, and the difference would look like a bug in the replay.
 *
 * The aimock harness supplies fixed model responses, so what remains under test
 * is the compiler's own determinism.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  mockClaudeEnv,
  stubCannedCompile,
  useAimockLifecycle,
} from "./fixtures/aimock-helper.js";
import { runCLI, expectCLIExit } from "./fixtures/run-cli.js";

const aimock = useAimockLifecycle("determinism");

const FROZEN_EPOCH = "1700000000";
const SOURCE = "# Determinism\n\nOne short source, compiled twice.\n";

/** Every file under `root`, as a relative path mapped to the hash of its bytes. */
async function fingerprint(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  async function walk(directory: string): Promise<void> {
    for (const entry of (await readdir(directory)).sort()) {
      const full = path.join(directory, entry);
      const info = await stat(full);
      if (info.isDirectory()) {
        await walk(full);
        continue;
      }
      const relative = path.relative(root, full).split(path.sep).join("/");
      files.set(relative, createHash("sha256").update(await readFile(full)).digest("hex"));
    }
  }
  await walk(root);
  return files;
}

/** Paths present in one fingerprint and not the other, plus contents that differ. */
function compare(first: Map<string, string>, second: Map<string, string>) {
  const onlyFirst = [...first.keys()].filter((k) => !second.has(k));
  const onlySecond = [...second.keys()].filter((k) => !first.has(k));
  const differing = [...first.keys()].filter((k) => second.has(k) && second.get(k) !== first.get(k));
  return { onlyFirst, onlySecond, differing };
}

async function compileOnce(env: NodeJS.ProcessEnv): Promise<string> {
  const cwd = await aimock.makeWorkspace(SOURCE);
  const result = await runCLI(["compile", "--review"], cwd, { ...env, SOURCE_DATE_EPOCH: FROZEN_EPOCH });
  expectCLIExit(result, 0);
  return cwd;
}

describe("compile determinism", () => {
  it("produces byte-identical output from identical inputs", async () => {
    const handle = await aimock.start();
    stubCannedCompile(handle);
    const env = mockClaudeEnv(handle);

    const firstRoot = await compileOnce(env);
    const secondRoot = await compileOnce(env);

    const { onlyFirst, onlySecond, differing } = compare(
      await fingerprint(firstRoot),
      await fingerprint(secondRoot),
    );

    // Named explicitly so a failure says which artefact is not reproducible
    // rather than only that something is.
    expect({ onlyFirst, onlySecond, differing }).toEqual({
      onlyFirst: [],
      onlySecond: [],
      differing: [],
    });
  }, 120_000);
});
