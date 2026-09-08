export interface DivergenceSummary {
  entropy: number; // normalized Shannon entropy, 0 (unanimous) .. 1 (evenly split across every offered category)
  hhi: number; // Herfindahl-Hirschman concentration index, 1/k (even) .. 1 (all-in-one)
  n: number;
  k: number; // number of categories considered, including ones with zero responses
}

/**
 * Separates "genuinely divided" from "mostly agreed with noise" for
 * multiple-choice responses. Normalizes by log(k) — the number of
 * *offered* options, not just the ones that got picked — so an even split
 * across 2 of 4 options doesn't read as "as diverse as it gets" the way
 * normalizing by the picked-options count would.
 */
export function computeDivergence(counts: number[]): DivergenceSummary {
  const k = counts.length;
  const n = counts.reduce((sum, c) => sum + c, 0);

  if (k <= 1 || n === 0) {
    return { entropy: 0, hhi: k > 0 ? 1 : 0, n, k };
  }

  let entropySum = 0;
  let hhiSum = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / n;
    entropySum -= p * Math.log(p);
    hhiSum += p * p;
  }

  const maxEntropy = Math.log(k);
  const entropy = maxEntropy > 0 ? entropySum / maxEntropy : 0;
  return { entropy, hhi: hhiSum, n, k };
}
