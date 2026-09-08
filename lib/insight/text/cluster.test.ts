import { describe, expect, it } from "vitest";
import { clusterResponses } from "./cluster";

describe("clusterResponses", () => {
  it("groups identical responses into a single cluster", () => {
    const clusters = clusterResponses(["great workshop", "great workshop", "great workshop"]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].memberIndices.sort()).toEqual([0, 1, 2]);
  });

  it("keeps completely unrelated responses in separate clusters", () => {
    const clusters = clusterResponses(["pizza", "kayaking", "thermodynamics"]);
    expect(clusters).toHaveLength(3);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  it("groups near-duplicate phrasing together and keeps a distinct topic separate", () => {
    const clusters = clusterResponses([
      "loved the workshop",
      "really loved the workshop today",
      "the workshop was great, loved it",
      "the venue parking was terrible",
    ]);
    // The three "loved the workshop" variants share enough vocabulary to
    // cluster; the parking complaint shares nothing with them.
    const sizes = clusters.map((c) => c.count).sort((a, b) => b - a);
    expect(sizes[0]).toBeGreaterThanOrEqual(2);
    expect(clusters.some((c) => c.memberIndices.includes(3) && c.count === 1)).toBe(true);
  });

  it("ignores empty/whitespace-only/stopword-only responses", () => {
    const clusters = clusterResponses(["", "   ", "the a an", "real feedback here"]);
    const totalClustered = clusters.reduce((sum, c) => sum + c.count, 0);
    expect(totalClustered).toBe(1);
  });

  it("returns an empty array for no responses", () => {
    expect(clusterResponses([])).toEqual([]);
  });

  it("folds overflow beyond the cluster cap into an Other bucket", () => {
    // 10 completely distinct single-word responses -> 10 singleton clusters,
    // more than the cap, so the smallest ones fold into "Other".
    const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"];
    const clusters = clusterResponses(words);
    expect(clusters.some((c) => c.exemplar === "Other")).toBe(true);
    const total = clusters.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(10);
  });
});
