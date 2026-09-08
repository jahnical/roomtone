import { describe, expect, it } from "vitest";
import { computeParticipation } from "./participation";

describe("computeParticipation", () => {
  it("computes response rate and silent count", () => {
    const result = computeParticipation(31, 24);
    expect(result).toEqual({ joined: 31, responded: 24, responseRate: 24 / 31, silent: 7 });
  });

  it("handles nobody having joined yet", () => {
    const result = computeParticipation(0, 0);
    expect(result).toEqual({ joined: 0, responded: 0, responseRate: 0, silent: 0 });
  });

  it("handles full participation", () => {
    const result = computeParticipation(10, 10);
    expect(result).toEqual({ joined: 10, responded: 10, responseRate: 1, silent: 0 });
  });

  it("clamps silent to zero if responded exceeds joined (a participant who left and rejoined)", () => {
    const result = computeParticipation(5, 6);
    expect(result.silent).toBe(0);
  });
});
