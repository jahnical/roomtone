import { describe, expect, it } from "vitest";
import { computeBimodality } from "./bimodality";

describe("computeBimodality", () => {
  it("flags a symmetric U-shaped distribution as bimodal (coefficient above 5/9)", () => {
    // Heavy at both ends of a 1-5 scale, almost nothing in the middle.
    const result = computeBimodality([
      { value: 1, count: 10 },
      { value: 3, count: 1 },
      { value: 5, count: 10 },
    ]);
    // Hand-computed: mean=3, m2=80/21, m3=0, m4=320/21
    // skewness=0, kurtosis=(320/21)/(80/21)^2=1.05, b=(0+1)/1.05=0.952
    expect(result.n).toBe(21);
    expect(result.coefficient).toBeCloseTo(0.952, 2);
    expect(result.isBimodal).toBe(true);
  });

  it("does not flag a single-peaked (roughly normal) distribution as bimodal", () => {
    const result = computeBimodality([
      { value: 1, count: 2 },
      { value: 2, count: 5 },
      { value: 3, count: 10 },
      { value: 4, count: 5 },
      { value: 5, count: 2 },
    ]);
    // Hand-computed: mean=3, m2=26/24, m3=0, m4=74/24
    // kurtosis=(74/24)/(26/24)^2≈2.627, b=(0+1)/2.627≈0.381
    expect(result.n).toBe(24);
    expect(result.coefficient).toBeCloseTo(0.381, 2);
    expect(result.isBimodal).toBe(false);
  });

  it("returns coefficient 0 and not bimodal when everyone picks the same value", () => {
    const result = computeBimodality([{ value: 4, count: 15 }]);
    expect(result.coefficient).toBe(0);
    expect(result.isBimodal).toBe(false);
  });

  it("returns null coefficient for fewer than 2 responses", () => {
    expect(computeBimodality([]).coefficient).toBeNull();
    expect(computeBimodality([{ value: 3, count: 1 }]).coefficient).toBeNull();
  });
});
