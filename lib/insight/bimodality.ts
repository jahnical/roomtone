export interface BimodalitySummary {
  n: number;
  coefficient: number | null; // Sarle's bimodality coefficient; null if undefined (n<2 or no variance)
  isBimodal: boolean;
}

// The classic cutoff: a uniform distribution's coefficient is exactly 5/9,
// so values above that are read as "more bimodal than uniform" rather than
// unimodal-with-spread.
const BIMODALITY_THRESHOLD = 5 / 9;

/**
 * Sarle's bimodality coefficient: b = (skewness² + 1) / kurtosis, computed
 * from population moments over a scale question's value→count histogram.
 * The point of this metric specifically: a mean can look perfectly
 * reasonable (e.g. 3 on a 1–5 scale) while hiding a room that's actually
 * split between confident and not-confident, with almost nobody in the
 * middle. The mean alone can't tell you that; this can.
 */
export function computeBimodality(valueCounts: { value: number; count: number }[]): BimodalitySummary {
  const n = valueCounts.reduce((sum, vc) => sum + vc.count, 0);
  if (n < 2) return { n, coefficient: null, isBimodal: false };

  const mean = valueCounts.reduce((sum, vc) => sum + vc.value * vc.count, 0) / n;

  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const { value, count } of valueCounts) {
    const d = value - mean;
    const d2 = d * d;
    m2 += count * d2;
    m3 += count * d2 * d;
    m4 += count * d2 * d2;
  }
  m2 /= n;
  m3 /= n;
  m4 /= n;

  // No variance at all — everyone picked the same value. Trivially unimodal.
  if (m2 <= 1e-9) return { n, coefficient: 0, isBimodal: false };

  const skewness = m3 / Math.pow(m2, 1.5);
  const kurtosis = m4 / (m2 * m2);
  if (kurtosis <= 0) return { n, coefficient: null, isBimodal: false };

  const coefficient = (skewness * skewness + 1) / kurtosis;
  return { n, coefficient, isBimodal: coefficient > BIMODALITY_THRESHOLD };
}
