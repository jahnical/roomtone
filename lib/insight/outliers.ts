import type { TextCluster } from "./text/cluster";

export interface OutlierResponse {
  text: string;
  index: number; // index into the original responses array
}

const DEFAULT_MIN_RESPONSES_FOR_OUTLIERS = 6;

/**
 * The minority answer worth reading aloud: a response whose theme nobody
 * else shares. Only meaningful once there's enough of a crowd that being a
 * singleton is actually notable — in a 3-response set, every response is
 * technically a singleton, and calling all of them "outliers" is noise,
 * not signal.
 */
export function findOutliers(
  clusters: TextCluster[],
  totalResponses: number,
  minResponsesForOutliers: number = DEFAULT_MIN_RESPONSES_FOR_OUTLIERS,
): OutlierResponse[] {
  if (totalResponses < minResponsesForOutliers) return [];

  return clusters
    .filter((c) => c.count === 1 && c.exemplar !== "Other")
    .map((c) => ({ text: c.exemplar, index: c.memberIndices[0] }));
}
