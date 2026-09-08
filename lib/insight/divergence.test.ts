import { describe, expect, it } from "vitest";
import { computeDivergence } from "./divergence";

describe("computeDivergence", () => {
  it("is zero for a unanimous distribution", () => {
    const result = computeDivergence([10, 0, 0, 0]);
    expect(result.entropy).toBeCloseTo(0, 10);
    expect(result.hhi).toBeCloseTo(1, 10);
    expect(result.n).toBe(10);
    expect(result.k).toBe(4);
  });

  it("is 1.0 for an evenly split 4-way distribution", () => {
    const result = computeDivergence([5, 5, 5, 5]);
    expect(result.entropy).toBeCloseTo(1, 10);
    expect(result.hhi).toBeCloseTo(0.25, 10); // 1/k
  });

  it("is 1.0 for an evenly split 2-way distribution", () => {
    const result = computeDivergence([12, 12]);
    expect(result.entropy).toBeCloseTo(1, 10);
    expect(result.hhi).toBeCloseTo(0.5, 10);
  });

  it("normalizes by the number of offered options, not just picked ones — an even split across 2 of 4 options is not maximal divergence", () => {
    const result = computeDivergence([10, 10, 0, 0]);
    // H = log(2), normalized by log(4): 0.5
    expect(result.entropy).toBeCloseTo(Math.log(2) / Math.log(4), 10);
    expect(result.entropy).toBeCloseTo(0.5, 10);
  });

  it("handles a single-option question as trivially unanimous", () => {
    const result = computeDivergence([7]);
    expect(result.entropy).toBe(0);
    expect(result.hhi).toBe(1);
  });

  it("handles zero responses", () => {
    const result = computeDivergence([0, 0, 0]);
    expect(result.entropy).toBe(0);
    expect(result.n).toBe(0);
  });

  it("computes a known intermediate case by hand", () => {
    // counts [6,3,1], n=10 -> p=[.6,.3,.1]
    // H = -(.6*ln.6 + .3*ln.3 + .1*ln.1) = -( .6*-0.5108 + .3*-1.20397 + .1*-2.302585)
    //   = -( -0.30648 - 0.361191 - 0.2302585 ) = 0.8979395
    // normalized by ln(3) = 1.098612
    const result = computeDivergence([6, 3, 1]);
    const expectedEntropy = 0.8979395 / Math.log(3);
    expect(result.entropy).toBeCloseTo(expectedEntropy, 4);
    // HHI = .36+.09+.01 = .46
    expect(result.hhi).toBeCloseTo(0.46, 10);
  });
});
