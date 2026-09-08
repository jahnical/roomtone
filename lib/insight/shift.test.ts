import { describe, expect, it } from "vitest";
import { computeOptionShift, computeScaleShift } from "./shift";

describe("computeOptionShift", () => {
  it("computes a known switch matrix by hand", () => {
    const before = [
      { participantId: "p1", optionLabel: "A" },
      { participantId: "p2", optionLabel: "A" },
      { participantId: "p3", optionLabel: "B" },
      { participantId: "p4", optionLabel: "B" },
      { participantId: "p5", optionLabel: "A" },
      { participantId: "onlyBefore", optionLabel: "A" }, // never answers "after" — excluded
    ];
    const after = [
      { participantId: "p1", optionLabel: "A" }, // stayed
      { participantId: "p2", optionLabel: "C" }, // A -> C
      { participantId: "p3", optionLabel: "B" }, // stayed
      { participantId: "p4", optionLabel: "C" }, // B -> C
      { participantId: "p5", optionLabel: "B" }, // A -> B
      { participantId: "onlyAfter", optionLabel: "C" }, // never answered "before" — excluded
    ];

    const result = computeOptionShift(before, after);
    expect(result.n).toBe(5);
    expect(result.stayedSameCount).toBe(2);

    const byKey = new Map(result.transitions.map((t) => [`${t.from}->${t.to}`, t.count]));
    expect(byKey.get("A->A")).toBe(1);
    expect(byKey.get("A->C")).toBe(1);
    expect(byKey.get("B->B")).toBe(1);
    expect(byKey.get("B->C")).toBe(1);
    expect(byKey.get("A->B")).toBe(1);
    expect(result.transitions).toHaveLength(5);
  });

  it("returns zero when nobody answered both questions", () => {
    const result = computeOptionShift(
      [{ participantId: "p1", optionLabel: "A" }],
      [{ participantId: "p2", optionLabel: "A" }],
    );
    expect(result.n).toBe(0);
    expect(result.transitions).toEqual([]);
  });

  it("sorts transitions by count descending", () => {
    const before = [
      { participantId: "p1", optionLabel: "A" },
      { participantId: "p2", optionLabel: "A" },
      { participantId: "p3", optionLabel: "A" },
      { participantId: "p4", optionLabel: "B" },
    ];
    const after = [
      { participantId: "p1", optionLabel: "B" },
      { participantId: "p2", optionLabel: "B" },
      { participantId: "p3", optionLabel: "B" },
      { participantId: "p4", optionLabel: "A" },
    ];
    const result = computeOptionShift(before, after);
    expect(result.transitions[0]).toEqual({ from: "A", to: "B", count: 3 });
  });
});

describe("computeScaleShift", () => {
  it("computes mean before/after and the delta by hand", () => {
    const before = [
      { participantId: "p1", value: 2 },
      { participantId: "p2", value: 3 },
      { participantId: "p3", value: 4 },
    ];
    const after = [
      { participantId: "p1", value: 4 },
      { participantId: "p2", value: 4 },
      { participantId: "p3", value: 5 },
    ];
    const result = computeScaleShift(before, after);
    expect(result.n).toBe(3);
    expect(result.meanBefore).toBeCloseTo(3, 10);
    expect(result.meanAfter).toBeCloseTo(13 / 3, 10);
    expect(result.meanDelta).toBeCloseTo(13 / 3 - 3, 10);
  });

  it("returns nulls when there is no overlap", () => {
    const result = computeScaleShift([{ participantId: "p1", value: 3 }], []);
    expect(result).toEqual({ n: 0, meanBefore: null, meanAfter: null, meanDelta: null });
  });
});
