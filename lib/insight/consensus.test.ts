import { describe, expect, it } from "vitest";
import { computeConsensus } from "./consensus";

describe("computeConsensus", () => {
  it("computes mean/median/sd/IQR/top-box/bottom-box by hand", () => {
    // Expands to [1,2,2,3,3,3,4,5], n=8
    const result = computeConsensus(
      [
        { value: 1, count: 1 },
        { value: 2, count: 2 },
        { value: 3, count: 3 },
        { value: 4, count: 1 },
        { value: 5, count: 1 },
      ],
      1,
      5,
    );
    expect(result.n).toBe(8);
    expect(result.mean).toBeCloseTo(2.875, 10);
    expect(result.sd).toBeCloseTo(1.16594, 4);
    expect(result.median).toBeCloseTo(3, 10);
    expect(result.q1).toBeCloseTo(2, 10);
    expect(result.q3).toBeCloseTo(3.25, 10);
    expect(result.iqr).toBeCloseTo(1.25, 10);
    expect(result.topBoxPct).toBeCloseTo(0.125, 10);
    expect(result.bottomBoxPct).toBeCloseTo(0.125, 10);
  });

  it("handles zero responses without dividing by zero", () => {
    const result = computeConsensus([], 1, 5);
    expect(result.n).toBe(0);
    expect(result.mean).toBeNull();
    expect(result.sd).toBeNull();
  });

  it("handles a single response (sd = 0, no spread)", () => {
    const result = computeConsensus([{ value: 4, count: 1 }], 1, 5);
    expect(result.n).toBe(1);
    expect(result.mean).toBe(4);
    expect(result.sd).toBe(0);
    expect(result.median).toBe(4);
  });

  it("reports 100% top-box when everyone picks the max", () => {
    const result = computeConsensus([{ value: 5, count: 6 }], 1, 5);
    expect(result.topBoxPct).toBe(1);
    expect(result.bottomBoxPct).toBe(0);
  });
});
