import { describe, expect, it } from "vitest";
import { findOutliers } from "./outliers";
import type { TextCluster } from "./text/cluster";

describe("findOutliers", () => {
  const clusters: TextCluster[] = [
    { exemplar: "loved it", count: 4, memberIndices: [0, 1, 2, 3] },
    { exemplar: "too fast", count: 3, memberIndices: [4, 5, 6] },
    { exemplar: "the snacks were surprisingly good", count: 1, memberIndices: [7] },
  ];

  it("surfaces singleton clusters as outliers once there's a meaningful crowd", () => {
    const result = findOutliers(clusters, 8);
    expect(result).toEqual([{ text: "the snacks were surprisingly good", index: 7 }]);
  });

  it("suppresses outliers when the total response count is too small to be meaningful", () => {
    const result = findOutliers(clusters, 3, 6);
    expect(result).toEqual([]);
  });

  it("never treats the 'Other' overflow bucket as an outlier even if its count happens to be 1", () => {
    const withOther: TextCluster[] = [...clusters, { exemplar: "Other", count: 1, memberIndices: [8] }];
    const result = findOutliers(withOther, 10);
    expect(result.some((o) => o.text === "Other")).toBe(false);
  });

  it("respects a custom minimum threshold", () => {
    expect(findOutliers(clusters, 5, 10)).toEqual([]);
    expect(findOutliers(clusters, 10, 10)).toHaveLength(1);
  });
});
