import { describe, expect, it } from "vitest";
import { computeLiveInsight } from "./live";

describe("computeLiveInsight", () => {
  it("produces a narration and divergence/chips for a multiple-choice aggregate", () => {
    const insight = computeLiveInsight(
      { type: "MULTIPLE_CHOICE", options: [{ id: "o1", label: "React" }, { id: "o2", label: "Svelte" }] },
      {
        type: "MULTIPLE_CHOICE",
        total: 10,
        options: [
          { optionId: "o1", label: "React", count: 5 },
          { optionId: "o2", label: "Svelte", count: 5 },
        ],
        respondedAt: Array.from({ length: 10 }, (_, i) => new Date(i * 1000).toISOString()),
      },
      10,
    );
    expect(insight.narration).toContain("10 of 10 responded (100%)");
    expect(insight.divergence?.entropy).toBeCloseTo(1, 10);
    expect(insight.chips.map((c) => c.label)).toContain("Divergence");
  });

  it("flags a bimodal split in the chips for a scale aggregate", () => {
    const insight = computeLiveInsight(
      { type: "SCALE", options: [] },
      {
        type: "SCALE",
        total: 21,
        min: 1,
        max: 5,
        mean: 3,
        counts: [
          { value: 1, count: 10 },
          { value: 2, count: 0 },
          { value: 3, count: 1 },
          { value: 4, count: 0 },
          { value: 5, count: 10 },
        ],
        respondedAt: Array.from({ length: 21 }, (_, i) => new Date(i * 1000).toISOString()),
      },
      21,
    );
    expect(insight.bimodality?.isBimodal).toBe(true);
    expect(insight.chips.some((c) => c.label === "Shape")).toBe(true);
  });

  it("names the top theme for an open-text aggregate with a clear majority theme", () => {
    const insight = computeLiveInsight(
      { type: "OPEN_TEXT", options: [] },
      {
        type: "OPEN_TEXT",
        total: 4,
        responses: [
          { id: "1", text: "loved the workshop", createdAt: new Date(0).toISOString() },
          { id: "2", text: "loved the workshop today", createdAt: new Date(1000).toISOString() },
          { id: "3", text: "really loved the workshop", createdAt: new Date(2000).toISOString() },
          { id: "4", text: "parking was terrible", createdAt: new Date(3000).toISOString() },
        ],
        respondedAt: [new Date(0).toISOString(), new Date(1000).toISOString(), new Date(2000).toISOString(), new Date(3000).toISOString()],
      },
      4,
    );
    expect(insight.narration).toContain("Top theme:");
    expect(insight.clusters?.length).toBeGreaterThan(0);
  });

  it("returns a bare participation narration when there's no aggregate yet", () => {
    const insight = computeLiveInsight({ type: "WORD_CLOUD", options: [] }, undefined, 15);
    expect(insight.narration).toBe("0 of 15 responded (0%).");
    expect(insight.chips).toEqual([]);
  });

  it("returns a bare participation narration for QNA (not yet implemented)", () => {
    const insight = computeLiveInsight({ type: "QNA", options: [] }, { type: "QNA" }, 10);
    expect(insight.narration).toBe("0 of 10 responded (0%).");
  });
});
