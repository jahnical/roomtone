"use server";

import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { clusterResponses } from "@/lib/insight/text/cluster";
import { computeQuestionAggregate } from "@/lib/realtime/aggregate";
import { labelThemes, suggestMisconception, type MisconceptionSuggestion } from "./insight";

/**
 * Reuses computeQuestionAggregate rather than re-querying Response rows
 * directly, so this sees the *exact* same ordered response list the
 * client's own clusterResponses() call ran against (see
 * lib/insight/live.ts). Clustering is order-dependent — the first-seen
 * response in a group becomes its exemplar — so an independently-ordered
 * re-fetch here would produce different exemplar strings for the same
 * semantic cluster, and the labels this returns wouldn't match any
 * exemplar the client is actually displaying.
 */
async function requireOpenTextResponses(sessionId: string, questionId: string, userId: string): Promise<string[]> {
  const owned = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!owned) {
    throw new Error("NOT_FOUND");
  }
  const aggregate = await computeQuestionAggregate(sessionId, questionId);
  if (aggregate?.type !== "OPEN_TEXT") return [];
  return aggregate.responses.map((r) => r.text);
}

export async function generateThemeLabels(sessionId: string, questionId: string): Promise<Record<string, string> | null> {
  const auth = await requireSession();
  const texts = await requireOpenTextResponses(sessionId, questionId, auth.userId);
  const clusters = clusterResponses(texts);
  return labelThemes(clusters);
}

export async function generateMisconception(
  sessionId: string,
  questionId: string,
): Promise<MisconceptionSuggestion | null> {
  const auth = await requireSession();
  const texts = await requireOpenTextResponses(sessionId, questionId, auth.userId);
  return suggestMisconception(texts);
}
