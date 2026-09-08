import "server-only";
import { chat, isAiEnabled } from "./provider";
import { MIN_CLUSTER_SIZE_TO_LABEL } from "./constants";
import type { TextCluster } from "@/lib/insight/text/cluster";

/**
 * Names the themes lib/insight/text/cluster.ts already found — statistics
 * does the grouping (TF-IDF + cosine similarity), the model only writes a
 * short label on top. Returns null if AI isn't configured, there's nothing
 * worth labelling, or the model call fails — callers treat that as "no
 * labels available," never an error.
 */
export async function labelThemes(clusters: TextCluster[]): Promise<Record<string, string> | null> {
  if (!isAiEnabled()) return null;

  const named = clusters.filter((c) => c.exemplar !== "Other" && c.count >= MIN_CLUSTER_SIZE_TO_LABEL);
  if (named.length === 0) return null;

  const prompt = named.map((c, i) => `${i + 1}. "${c.exemplar}" (${c.count} similar responses)`).join("\n");
  const response = await chat([
    {
      role: "system",
      content:
        "You label clusters of short classroom poll responses with a concise 2-4 word theme name. Respond with exactly one label per line, numbered to match the input (e.g. \"1. Time pressure\"), and nothing else.",
    },
    { role: "user", content: prompt },
  ]);
  if (!response) return null;

  const labels: Record<string, string> = {};
  for (const line of response.split("\n")) {
    const match = line.match(/^\s*(\d+)\.\s*(.+)$/);
    if (!match) continue;
    const cluster = named[Number(match[1]) - 1];
    if (cluster) labels[cluster.exemplar] = match[2].trim();
  }
  return Object.keys(labels).length > 0 ? labels : null;
}

export interface MisconceptionSuggestion {
  misconception: string;
  followUpQuestion: string;
}

const MIN_RESPONSES_FOR_MISCONCEPTION = 3;
const MAX_RESPONSES_SAMPLED = 30;

/** Spots a common misconception across a question's open-text responses and suggests one concrete follow-up question. */
export async function suggestMisconception(responses: string[]): Promise<MisconceptionSuggestion | null> {
  if (!isAiEnabled() || responses.length < MIN_RESPONSES_FOR_MISCONCEPTION) return null;

  const sample = responses.slice(0, MAX_RESPONSES_SAMPLED).map((r) => `- ${r}`).join("\n");
  const response = await chat([
    {
      role: "system",
      content:
        "You review open-text classroom poll responses to spot one common misconception or point of confusion, and suggest a specific follow-up question the teacher could ask to address it. Respond in exactly this format and nothing else:\nMisconception: <one sentence>\nFollow-up: <one question>",
    },
    { role: "user", content: sample },
  ]);
  if (!response) return null;

  const misconceptionMatch = response.match(/Misconception:\s*(.+)/i);
  const followUpMatch = response.match(/Follow-up:\s*(.+)/i);
  if (!misconceptionMatch || !followUpMatch) return null;

  return { misconception: misconceptionMatch[1].trim(), followUpQuestion: followUpMatch[1].trim() };
}
