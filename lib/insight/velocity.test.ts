import { describe, expect, it } from "vitest";
import { computeVelocity, velocityRatio } from "./velocity";

describe("computeVelocity", () => {
  it("computes time-to-50%/90% and median inter-arrival for evenly spaced responses", () => {
    // 5 responses, exactly 1000ms apart: t=0,1000,2000,3000,4000
    const result = computeVelocity([3000, 0, 4000, 1000, 2000]);
    expect(result.n).toBe(5);
    expect(result.msToHalf).toBe(2000);
    expect(result.msToNinety).toBe(4000);
    expect(result.medianInterArrivalMs).toBe(1000);
  });

  it("handles a single response", () => {
    const result = computeVelocity([5000]);
    expect(result.n).toBe(1);
    expect(result.msToHalf).toBe(0);
    expect(result.msToNinety).toBe(0);
    expect(result.medianInterArrivalMs).toBeNull();
  });

  it("handles no responses", () => {
    const result = computeVelocity([]);
    expect(result).toEqual({ n: 0, msToHalf: null, msToNinety: null, medianInterArrivalMs: null });
  });

  it("handles a burst of simultaneous responses", () => {
    const result = computeVelocity([100, 100, 100, 100]);
    expect(result.msToHalf).toBe(0);
    expect(result.msToNinety).toBe(0);
    expect(result.medianInterArrivalMs).toBe(0);
  });
});

describe("velocityRatio", () => {
  it("reports how much slower/faster the current question was vs a baseline median", () => {
    expect(velocityRatio(2000, [1000, 1000, 1000])).toBeCloseTo(2.0, 10);
    expect(velocityRatio(1500, [3000, 3000, 3000])).toBeCloseTo(0.5, 10);
  });

  it("uses the median of the baseline, not the mean, so one outlier question doesn't skew it", () => {
    // median of [2000, 4000, 36000] is 4000, not the mean (14000)
    expect(velocityRatio(4000, [2000, 4000, 36000])).toBeCloseTo(1.0, 10);
  });

  it("returns null when there is no current value or no baseline", () => {
    expect(velocityRatio(null, [1000])).toBeNull();
    expect(velocityRatio(1000, [])).toBeNull();
  });

  it("withholds the ratio when the current value is below the noise floor — a near-instant burst isn't a meaningful 'fast' signal, and dividing by it would produce an absurd multiplier", () => {
    expect(velocityRatio(50, [5000, 5000, 5000])).toBeNull();
  });

  it("ignores baseline entries below the noise floor when computing the comparison median", () => {
    // The 10ms and 20ms baseline entries are noise and get filtered out;
    // only the 4000ms entry clears the floor, so it alone is the median.
    expect(velocityRatio(4000, [10, 20, 4000])).toBeCloseTo(1.0, 10);
  });
});
