import { describe, expect, it } from "vitest";
import { narrate } from "./narrate";

describe("narrate", () => {
  it("reproduces the plan's worked example for a split multiple-choice question", () => {
    const text = narrate({
      questionType: "MULTIPLE_CHOICE",
      participation: { joined: 31, responded: 24, responseRate: 24 / 31, silent: 7 },
      divergence: { entropy: 0.82, hhi: 0.35, n: 24, k: 4 },
      topOptions: [
        { label: "B", pct: 0.41 },
        { label: "D", pct: 0.38 },
      ],
      velocityRatio: 2.1,
    });
    expect(text).toContain("24 of 31 responded (77%).");
    expect(text).toContain("The room is split, divergence 0.82, clustering at B (41%) and D (38%).");
    expect(text).toContain("Answers arrived 2.1× slower than your session average, which usually means the prompt was ambiguous.");
  });

  it("calls out strong consensus for a low-divergence multiple-choice question", () => {
    const text = narrate({
      questionType: "MULTIPLE_CHOICE",
      participation: { joined: 20, responded: 20, responseRate: 1, silent: 0 },
      divergence: { entropy: 0.1, hhi: 0.85, n: 20, k: 3 },
      topOptions: [{ label: "React", pct: 0.9 }],
    });
    expect(text).toContain("Strong consensus around React (90%).");
  });

  it("surfaces a hidden bimodal split behind a moderate scale average", () => {
    const text = narrate({
      questionType: "SCALE",
      participation: { joined: 21, responded: 21, responseRate: 1, silent: 0 },
      consensus: { n: 21, mean: 3, median: 3, sd: 2, min: 1, max: 5, q1: 1, q3: 5, iqr: 4, topBoxPct: 0.48, bottomBoxPct: 0.48 },
      bimodality: { n: 21, coefficient: 0.95, isBimodal: true },
    });
    expect(text).toContain("Average 3.0 of 5.");
    expect(text).toContain("The average hides a split");
  });

  it("stays silent about velocity when it's within normal range", () => {
    const text = narrate({
      questionType: "MULTIPLE_CHOICE",
      participation: { joined: 10, responded: 10, responseRate: 1, silent: 0 },
      divergence: { entropy: 0.5, hhi: 0.4, n: 10, k: 2 },
      topOptions: [{ label: "A", pct: 0.6 }],
      velocityRatio: 1.1,
    });
    expect(text).not.toContain("slower");
    expect(text).not.toContain("faster");
  });

  it("always leads with the participation line regardless of question type", () => {
    const text = narrate({
      questionType: "OPEN_TEXT",
      participation: { joined: 15, responded: 9, responseRate: 0.6, silent: 6 },
    });
    expect(text).toBe("9 of 15 responded (60%).");
  });
});
