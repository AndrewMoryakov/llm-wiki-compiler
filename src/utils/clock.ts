/**
 * The one source of wall-clock time for anything that reaches compiler output.
 *
 * A compilation is reproducible only if the same inputs produce the same bytes,
 * and a timestamp read from the system clock breaks that by construction: two
 * runs of the same sources against the same model responses differed in the page
 * frontmatter, in the candidate metadata, and in the text of the generated index,
 * which carries "Generated <time>" in a footer whose own comment asks for it to
 * stay byte-identical.
 *
 * When `SOURCE_DATE_EPOCH` is set — the reproducible-builds convention, in whole
 * seconds since the Unix epoch — every timestamp below is frozen to it. When it
 * is unset, behaviour is unchanged and the real clock is used, so ordinary
 * interactive runs still record when they happened.
 *
 * Durations measured for logging are deliberately not routed through here. They
 * do not reach the output, and freezing them would report every compile as
 * instantaneous.
 */

const EPOCH_VARIABLE = "SOURCE_DATE_EPOCH";

/**
 * The frozen epoch, or null when the variable is unset or unusable.
 *
 * A malformed value is ignored rather than fatal: a reproducible build that
 * silently fell back to the real clock would be worse, but so would refusing to
 * compile because an unrelated tool exported something odd. The value is
 * validated as a non-negative integer count of seconds.
 */
function frozenEpochMs(): number | null {
  const raw = process.env[EPOCH_VARIABLE]?.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) ? seconds * 1000 : null;
}

/** Current time, frozen when `SOURCE_DATE_EPOCH` is set. */
export function now(): Date {
  const frozen = frozenEpochMs();
  return frozen === null ? new Date() : new Date(frozen);
}

/** Current time as an ISO-8601 string, frozen when `SOURCE_DATE_EPOCH` is set. */
export function nowIso(): string {
  return now().toISOString();
}

/** True when output timestamps are frozen, for diagnostics that want to say so. */
export function isClockFrozen(): boolean {
  return frozenEpochMs() !== null;
}
