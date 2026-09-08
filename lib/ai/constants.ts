// Deliberately has no "server-only" import: this file holds plain values
// shared between server code (lib/ai/insight.ts) and client code
// (components/stage/insight-drawer.tsx, which needs to decide whether
// there's anything worth labelling *before* calling the server action).
// Importing a real value — not just a type — from a "server-only" module
// pulls that whole module into the client bundle regardless of any
// `import type` siblings in the same statement, which is exactly the
// mistake this file avoids.

/** Clusters smaller than this aren't worth an AI-generated label — a singleton "theme" is just one response. */
export const MIN_CLUSTER_SIZE_TO_LABEL = 2;
