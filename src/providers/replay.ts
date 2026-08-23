/**
 * Record/replay providers.
 *
 * These exist so a compilation can be split around a sandbox boundary: the pass
 * that talks to a model runs where network and credentials are allowed and
 * records every exchange, and the pass that produces the artefact runs with no
 * network and no credential at all, served entirely from that recording.
 *
 * Two properties matter and are enforced here rather than documented:
 *
 * 1. Exchanges are keyed by a hash of the request, never by call order. Page
 *    generation runs concurrently, so call order is not stable between passes
 *    and an ordinal key would make replay flaky in a way that looks like a
 *    compiler bug.
 * 2. A replay miss is a hard failure. Falling back to a live call would silently
 *    put the network back into the pass that was supposed to be offline, which
 *    is exactly the property the split was created to obtain.
 */
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

import type { EmbeddingInputType, LLMMessage, LLMProvider, LLMTool } from "../utils/provider.js";

type ExchangeMethod = "complete" | "stream" | "toolCall" | "embed" | "embedBatch";

interface RecordedExchange {
  key: string;
  method: ExchangeMethod;
  /** Present for text methods. */
  response?: string;
  /** Present for embedding methods. */
  embedding?: number[];
  embeddings?: number[][];
}

/**
 * The identity of a request. Every input that can change a response is part of
 * it; nothing else is, so the same logical call in two passes produces the same
 * key.
 */
function exchangeKey(method: ExchangeMethod, payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ method, payload }))
    .digest("hex");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} must be set. The replay providers refuse to guess a recording location, ` +
        `because guessing wrong would either lose a recording or silently replay the wrong one.`,
    );
  }
  return value;
}

/**
 * Delegates to a real provider and appends every exchange to a recording.
 *
 * Lines are appended one call at a time so a crash keeps whatever completed,
 * and so concurrent generation does not interleave partial records.
 */
export class RecordingProvider implements LLMProvider {
  constructor(
    private readonly inner: LLMProvider,
    private readonly recordingPath: string,
  ) {}

  private write(entry: RecordedExchange): void {
    appendFileSync(this.recordingPath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  async complete(system: string, messages: LLMMessage[], maxTokens: number): Promise<string> {
    const response = await this.inner.complete(system, messages, maxTokens);
    this.write({ key: exchangeKey("complete", { system, messages, maxTokens }), method: "complete", response });
    return response;
  }

  async stream(
    system: string,
    messages: LLMMessage[],
    maxTokens: number,
    onToken?: (text: string) => void,
  ): Promise<string> {
    const response = await this.inner.stream(system, messages, maxTokens, onToken);
    this.write({ key: exchangeKey("stream", { system, messages, maxTokens }), method: "stream", response });
    return response;
  }

  async toolCall(
    system: string,
    messages: LLMMessage[],
    tools: LLMTool[],
    maxTokens: number,
  ): Promise<string> {
    const response = await this.inner.toolCall(system, messages, tools, maxTokens);
    this.write({
      key: exchangeKey("toolCall", { system, messages, tools, maxTokens }),
      method: "toolCall",
      response,
    });
    return response;
  }

  async embed(text: string, inputType?: EmbeddingInputType): Promise<number[]> {
    const embedding = await this.inner.embed(text, inputType);
    this.write({ key: exchangeKey("embed", { text, inputType }), method: "embed", embedding });
    return embedding;
  }

  async embedBatch(texts: string[], inputType?: EmbeddingInputType): Promise<number[][]> {
    const embeddings = this.inner.embedBatch
      ? await this.inner.embedBatch(texts, inputType)
      : await Promise.all(texts.map((text) => this.inner.embed(text, inputType)));
    this.write({ key: exchangeKey("embedBatch", { texts, inputType }), method: "embedBatch", embeddings });
    return embeddings;
  }
}

/**
 * Serves recorded exchanges and nothing else. Holds no credential, opens no
 * connection, and has no underlying provider to fall back to.
 */
export class ReplayProvider implements LLMProvider {
  private readonly exchanges: Map<string, RecordedExchange>;

  constructor(recordingPath: string) {
    if (!existsSync(recordingPath)) {
      throw new Error(`Replay recording not found at ${recordingPath}.`);
    }
    this.exchanges = new Map();
    for (const line of readFileSync(recordingPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const entry = JSON.parse(trimmed) as RecordedExchange;
      // Last write wins: a re-recording of the same request supersedes the older
      // answer rather than being ambiguous about which one applies.
      this.exchanges.set(entry.key, entry);
    }
  }

  private lookup(method: ExchangeMethod, payload: unknown): RecordedExchange {
    const key = exchangeKey(method, payload);
    const entry = this.exchanges.get(key);
    if (!entry) {
      throw new Error(
        `No recorded ${method} response for request ${key}. Replay does not fall back to a live call: ` +
          `the recording is incomplete, or this pass is not compiling the same input as the recorded one.`,
      );
    }
    return entry;
  }

  private text(method: ExchangeMethod, payload: unknown): string {
    const entry = this.lookup(method, payload);
    if (typeof entry.response !== "string") {
      throw new Error(`Recorded ${method} exchange ${entry.key} carries no text response.`);
    }
    return entry.response;
  }

  async complete(system: string, messages: LLMMessage[], maxTokens: number): Promise<string> {
    return this.text("complete", { system, messages, maxTokens });
  }

  async stream(
    system: string,
    messages: LLMMessage[],
    maxTokens: number,
    onToken?: (text: string) => void,
  ): Promise<string> {
    const response = this.text("stream", { system, messages, maxTokens });
    // Replay has nothing to stream. Emitting the whole text once keeps callers
    // that render progress working without pretending the tokens arrived live.
    onToken?.(response);
    return response;
  }

  async toolCall(
    system: string,
    messages: LLMMessage[],
    tools: LLMTool[],
    maxTokens: number,
  ): Promise<string> {
    return this.text("toolCall", { system, messages, tools, maxTokens });
  }

  async embed(text: string, inputType?: EmbeddingInputType): Promise<number[]> {
    const entry = this.lookup("embed", { text, inputType });
    if (!entry.embedding) throw new Error(`Recorded embed exchange ${entry.key} carries no embedding.`);
    return entry.embedding;
  }

  async embedBatch(texts: string[], inputType?: EmbeddingInputType): Promise<number[][]> {
    const entry = this.lookup("embedBatch", { texts, inputType });
    if (!entry.embeddings) throw new Error(`Recorded embedBatch exchange ${entry.key} carries no embeddings.`);
    return entry.embeddings;
  }
}

/** Reads `LLMWIKI_REPLAY_FILE`. */
export function getReplayProvider(): LLMProvider {
  return new ReplayProvider(requireEnv("LLMWIKI_REPLAY_FILE"));
}

/**
 * Reads `LLMWIKI_RECORD_FILE` and `LLMWIKI_RECORD_PROVIDER`, wrapping the named
 * provider. The provider to record is named explicitly rather than taken from
 * `LLMWIKI_PROVIDER`, which is already "record" at this point.
 */
export function getRecordingProvider(build: (providerName: string) => LLMProvider): LLMProvider {
  return new RecordingProvider(
    build(requireEnv("LLMWIKI_RECORD_PROVIDER")),
    requireEnv("LLMWIKI_RECORD_FILE"),
  );
}
