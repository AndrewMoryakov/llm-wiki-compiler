import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RecordingProvider, ReplayProvider } from "../src/providers/replay.js";
import type { LLMMessage, LLMProvider, LLMTool } from "../src/utils/provider.js";

/** A provider whose answers depend only on its inputs, and that counts its calls. */
class StubProvider implements LLMProvider {
  calls = 0;
  async complete(system: string, messages: LLMMessage[], maxTokens: number): Promise<string> {
    this.calls += 1;
    return `completed:${system}:${messages.length}:${maxTokens}`;
  }
  async stream(system: string, messages: LLMMessage[], maxTokens: number, onToken?: (t: string) => void) {
    this.calls += 1;
    const text = `streamed:${system}:${messages.length}:${maxTokens}`;
    onToken?.(text);
    return text;
  }
  async toolCall(system: string, messages: LLMMessage[], tools: LLMTool[], maxTokens: number) {
    this.calls += 1;
    return `tools:${tools.length}:${maxTokens}`;
  }
  async embed(text: string) {
    this.calls += 1;
    return [text.length, 1, 2];
  }
}

const messages: LLMMessage[] = [{ role: "user", content: "compile this source" }];

describe("record and replay providers", () => {
  let directory: string;
  let recording: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "llmwiki-replay-"));
    recording = join(directory, "exchanges.jsonl");
    writeFileSync(recording, "");
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it("replays exactly what was recorded, without calling the inner provider", async () => {
    const inner = new StubProvider();
    const recorder = new RecordingProvider(inner, recording);
    const recorded = await recorder.complete("system", messages, 512);

    const replay = new ReplayProvider(recording);
    const replayed = await replay.complete("system", messages, 512);

    expect(replayed).toBe(recorded);
    expect(inner.calls).toBe(1);
  });

  it("keys exchanges by request rather than by call order", async () => {
    const recorder = new RecordingProvider(new StubProvider(), recording);
    await recorder.complete("first", messages, 512);
    await recorder.complete("second", messages, 512);

    // Page generation runs concurrently, so a second pass may issue the same
    // requests in a different order. Replay must not care.
    const replay = new ReplayProvider(recording);
    const second = await replay.complete("second", messages, 512);
    const first = await replay.complete("first", messages, 512);

    expect(first).toBe("completed:first:1:512");
    expect(second).toBe("completed:second:1:512");
  });

  it("fails on a request that was never recorded, and never falls back", async () => {
    const recorder = new RecordingProvider(new StubProvider(), recording);
    await recorder.complete("recorded", messages, 512);
    const replay = new ReplayProvider(recording);

    // A fallback here would put the network back into the pass that exists
    // precisely to run without one.
    await expect(replay.complete("never recorded", messages, 512)).rejects.toThrow(
      /No recorded complete response/,
    );
  });

  it("distinguishes methods with identical arguments", async () => {
    const recorder = new RecordingProvider(new StubProvider(), recording);
    await recorder.complete("same", messages, 256);
    const replay = new ReplayProvider(recording);

    expect(await replay.complete("same", messages, 256)).toBe("completed:same:1:256");
    await expect(replay.stream("same", messages, 256)).rejects.toThrow(/No recorded stream response/);
  });

  it("distinguishes requests that differ only in max tokens", async () => {
    const recorder = new RecordingProvider(new StubProvider(), recording);
    await recorder.complete("same", messages, 256);
    const replay = new ReplayProvider(recording);

    await expect(replay.complete("same", messages, 512)).rejects.toThrow(/No recorded/);
  });

  it("records and replays tool calls and embeddings", async () => {
    const recorder = new RecordingProvider(new StubProvider(), recording);
    const tools: LLMTool[] = [{ name: "extract", description: "d", input_schema: { type: "object" } } as LLMTool];
    const recordedTools = await recorder.toolCall("system", messages, tools, 128);
    const recordedEmbedding = await recorder.embed("evidence text");

    const replay = new ReplayProvider(recording);

    expect(await replay.toolCall("system", messages, tools, 128)).toBe(recordedTools);
    expect(await replay.embed("evidence text")).toEqual(recordedEmbedding);
  });

  it("emits the whole replayed text once rather than pretending to stream", async () => {
    const recorder = new RecordingProvider(new StubProvider(), recording);
    await recorder.stream("system", messages, 64);

    const chunks: string[] = [];
    const replayed = await new ReplayProvider(recording).stream("system", messages, 64, (t) => chunks.push(t));

    expect(chunks).toEqual([replayed]);
  });

  it("refuses a recording that does not exist", () => {
    expect(() => new ReplayProvider(join(directory, "absent.jsonl"))).toThrow(/not found/);
  });

  it("lets a later recording of the same request supersede the earlier answer", async () => {
    writeFileSync(
      recording,
      readFileSync(recording, "utf8") +
        `${JSON.stringify({ key: "k", method: "complete", response: "old" })}\n` +
        `${JSON.stringify({ key: "k", method: "complete", response: "new" })}\n`,
    );
    const replay = new ReplayProvider(recording);

    expect((replay as unknown as { exchanges: Map<string, { response: string }> }).exchanges.get("k")?.response)
      .toBe("new");
  });
});
