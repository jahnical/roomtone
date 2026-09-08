// Shared text normalization for anything that turns free-text responses into
// discrete tokens — the word cloud aggregate (M3) and, later, the TF-IDF
// theme clustering in lib/insight/text/cluster.ts (M4). Kept minimal and
// dependency-free since it runs on every response.

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "so", "because",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "to", "of", "in", "on", "at", "by", "for", "with", "about", "as", "into", "like", "through",
  "this", "that", "these", "those", "it", "its",
  "i", "me", "my", "we", "us", "our", "you", "your", "they", "them", "their", "he", "him", "his", "she", "her",
  "not", "no", "yes", "do", "does", "did", "doing",
  "can", "could", "would", "should", "will", "shall", "may", "might", "must",
  "very", "just", "really", "also", "too", "more", "most", "some", "any",
]);

// Combining diacritical marks block (U+0300–U+036F) — what NFKD decomposition
// splits accented letters into, e.g. "é" -> "e" + U+0301. Stripping this
// range after normalize("NFKD") is the standard way to fold accents to
// plain ASCII letters without a lookup table.
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Lowercases, strips diacritics/punctuation, drops single-letter tokens and
 * common stopwords. Preserves internal apostrophes/hyphens ("don't",
 * "state-of-the-art") since collapsing them changes the word.
 */
export function tokenize(text: string): string[] {
  const folded = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ");

  return folded
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, "")) // trim stray leading/trailing punctuation
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
