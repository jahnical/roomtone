import { tokenize } from "./normalize";

export interface TextCluster {
  exemplar: string; // representative original response text for this theme
  count: number;
  memberIndices: number[]; // indices into the original `responses` array passed in
}

interface Doc {
  index: number;
  text: string;
  tokens: string[];
  tf: Map<string, number>;
}

/** TF-IDF vector per doc: term frequency (within-doc) × inverse document frequency (across the corpus). Smoothed IDF avoids a division blow-up for terms that appear in every response. */
function buildTfIdfVectors(docs: Doc[]): Map<number, Map<string, number>> {
  const documentFrequency = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc.tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const N = docs.length;
  const vectors = new Map<number, Map<string, number>>();
  for (const doc of docs) {
    const vector = new Map<string, number>();
    const totalTokens = doc.tokens.length || 1;
    for (const [term, tf] of doc.tf) {
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log((N + 1) / (df + 1)) + 1;
      vector.set(term, (tf / totalTokens) * idf);
    }
    vectors.set(doc.index, vector);
  }
  return vectors;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let normA = 0;
  for (const v of a.values()) normA += v * v;
  let normB = 0;
  for (const v of b.values()) normB += v * v;
  if (normA === 0 || normB === 0) return 0;

  const [smaller, larger] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, v] of smaller) {
    const bv = larger.get(term);
    if (bv !== undefined) dot += v * bv;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Tuned for short classroom responses (a sentence or two), not long documents.
const SIMILARITY_THRESHOLD = 0.28;
const MAX_CLUSTERS = 8;

/**
 * Greedy single-pass clustering: each response joins the most similar
 * existing cluster if that similarity clears the threshold, otherwise it
 * starts a new cluster. Clusters beyond MAX_CLUSTERS-1 fold into a final
 * "Other" bucket — turning 40 open answers into a handful of readable
 * themes rather than 40 individual data points.
 */
export function clusterResponses(responses: string[]): TextCluster[] {
  const docs: Doc[] = responses
    .map((text, index) => {
      const tokens = tokenize(text);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      return { index, text, tokens, tf };
    })
    .filter((d) => d.tokens.length > 0);

  if (docs.length === 0) return [];

  const vectors = buildTfIdfVectors(docs);

  interface ClusterState {
    exemplarIndex: number;
    memberIndices: number[];
    centroid: Map<string, number>;
  }
  const clusters: ClusterState[] = [];

  function recomputeCentroid(cluster: ClusterState) {
    const sums = new Map<string, number>();
    for (const idx of cluster.memberIndices) {
      const vector = vectors.get(idx);
      if (!vector) continue;
      for (const [term, v] of vector) sums.set(term, (sums.get(term) ?? 0) + v);
    }
    const n = cluster.memberIndices.length;
    for (const [term, v] of sums) sums.set(term, v / n);
    cluster.centroid = sums;
  }

  for (const doc of docs) {
    const vector = vectors.get(doc.index);
    if (!vector) continue;

    let bestCluster: ClusterState | null = null;
    let bestSimilarity = 0;
    for (const cluster of clusters) {
      const similarity = cosineSimilarity(vector, cluster.centroid);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestSimilarity >= SIMILARITY_THRESHOLD) {
      bestCluster.memberIndices.push(doc.index);
      recomputeCentroid(bestCluster);
    } else {
      clusters.push({ exemplarIndex: doc.index, memberIndices: [doc.index], centroid: new Map(vector) });
    }
  }

  const sorted = clusters
    .map((c) => ({
      exemplar: docs.find((d) => d.index === c.exemplarIndex)?.text ?? "",
      count: c.memberIndices.length,
      memberIndices: c.memberIndices,
    }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length <= MAX_CLUSTERS) return sorted;

  const top = sorted.slice(0, MAX_CLUSTERS - 1);
  const overflow = sorted.slice(MAX_CLUSTERS - 1);
  const otherCount = overflow.reduce((sum, c) => sum + c.count, 0);
  const otherMembers = overflow.flatMap((c) => c.memberIndices);
  return [...top, { exemplar: "Other", count: otherCount, memberIndices: otherMembers }];
}
