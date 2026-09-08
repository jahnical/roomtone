export interface ConsensusSummary {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number;
  max: number;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  topBoxPct: number | null; // fraction who picked the scale's max value
  bottomBoxPct: number | null; // fraction who picked the scale's min value
}

/** Linear-interpolation percentile (numpy's default "linear" method) over an already-sorted array. */
function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/** Honest summary stats for a rating question — the counterpart to divergence.ts, but for an ordered scale rather than unordered categories. */
export function computeConsensus(
  valueCounts: { value: number; count: number }[],
  scaleMin: number,
  scaleMax: number,
): ConsensusSummary {
  const n = valueCounts.reduce((sum, vc) => sum + vc.count, 0);
  if (n === 0) {
    return {
      n: 0,
      mean: null,
      median: null,
      sd: null,
      min: scaleMin,
      max: scaleMax,
      q1: null,
      q3: null,
      iqr: null,
      topBoxPct: null,
      bottomBoxPct: null,
    };
  }

  const sortedValues: number[] = [];
  for (const { value, count } of [...valueCounts].sort((a, b) => a.value - b.value)) {
    for (let i = 0; i < count; i++) sortedValues.push(value);
  }

  const mean = sortedValues.reduce((sum, v) => sum + v, 0) / n;
  const variance = sortedValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  const median = percentile(sortedValues, 50);
  const q1 = percentile(sortedValues, 25);
  const q3 = percentile(sortedValues, 75);

  const topCount = valueCounts.find((vc) => vc.value === scaleMax)?.count ?? 0;
  const bottomCount = valueCounts.find((vc) => vc.value === scaleMin)?.count ?? 0;

  return {
    n,
    mean,
    median,
    sd,
    min: scaleMin,
    max: scaleMax,
    q1,
    q3,
    iqr: q3 - q1,
    topBoxPct: topCount / n,
    bottomBoxPct: bottomCount / n,
  };
}
