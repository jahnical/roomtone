export interface VelocitySummary {
  n: number;
  msToHalf: number | null; // ms from the first response until 50% of responses had arrived
  msToNinety: number | null; // ms from the first response until 90% had arrived
  medianInterArrivalMs: number | null;
}

/**
 * How quickly the room converged on an answer, measured relative to this
 * question's own first response (not "time since the question was shown" —
 * Roomtone doesn't currently record a per-question activation timestamp,
 * so this is the honest signal available: did answers trickle in slowly
 * once they started, or arrive in a burst).
 */
export function computeVelocity(timestampsMs: number[]): VelocitySummary {
  const sorted = [...timestampsMs].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return { n: 0, msToHalf: null, msToNinety: null, medianInterArrivalMs: null };
  }

  const t0 = sorted[0];
  const msToPercent = (pct: number): number => {
    const idx = Math.min(Math.max(Math.ceil((pct / 100) * n) - 1, 0), n - 1);
    return sorted[idx] - t0;
  };

  const gaps: number[] = [];
  for (let i = 1; i < n; i++) gaps.push(sorted[i] - sorted[i - 1]);
  gaps.sort((a, b) => a - b);
  const medianInterArrivalMs =
    gaps.length === 0
      ? null
      : gaps.length % 2 === 1
        ? gaps[(gaps.length - 1) / 2]
        : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2;

  return { n, msToHalf: msToPercent(50), msToNinety: msToPercent(90), medianInterArrivalMs };
}

// Below this, "time to 50%" is measuring noise, not a room's actual
// thinking time — a burst of responses arriving within the same second
// (a fast typist, a network retry batch, or literally simultaneous
// taps) makes the numerator (or the baseline's denominator) near zero,
// and a ratio against near-zero is unstable: dividing by an almost-zero
// baseline can print something like "61648.5× faster", which is
// mathematically what happened but useless to a presenter. Below the
// floor, there's nothing honest to say about relative speed, so the
// ratio is withheld rather than shown as a meaningless huge number.
const MIN_MEANINGFUL_MS = 1000;

/**
 * How this question's convergence speed compares to a baseline (typically
 * the presenter's own past questions in this session). Ratio > 1 means
 * slower than usual — a `narrate.ts` consumer treats a high ratio as a
 * signal the prompt may have been ambiguous or hard.
 */
export function velocityRatio(currentMsToHalf: number | null, baselineMsToHalf: number[]): number | null {
  if (currentMsToHalf == null || currentMsToHalf < MIN_MEANINGFUL_MS) return null;
  const valid = baselineMsToHalf.filter((v) => v >= MIN_MEANINGFUL_MS);
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return currentMsToHalf / median;
}
