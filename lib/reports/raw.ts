import "server-only";
import { prisma } from "@/lib/db/client";
import type { QuestionTypeValue } from "@/lib/validation/deck";

export interface RawResponseRow {
  participantNumber: number; // sequential per session, by join order — not the raw token
  questionOrder: number;
  questionPrompt: string;
  questionType: QuestionTypeValue;
  value: string;
  createdAt: string;
}

/** Raw per-response rows for CSV export. Participants are numbered by join order rather than exposing Participant.token — the token is a replay-usable identifier (it's what /api/respond authenticates with) and a live session shouldn't hand it out in a downloadable file. */
export async function getRawResponseRows(sessionId: string): Promise<RawResponseRow[]> {
  const [participants, responses] = await Promise.all([
    prisma.participant.findMany({
      where: { sessionId },
      orderBy: { joinedAt: "asc" },
      select: { id: true },
    }),
    prisma.response.findMany({
      where: { sessionId },
      include: {
        question: { select: { order: true, prompt: true, type: true } },
        option: { select: { label: true } },
      },
      orderBy: [{ question: { order: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  const participantNumber = new Map(participants.map((p, i) => [p.id, i + 1]));

  return responses.map((r) => ({
    participantNumber: participantNumber.get(r.participantId) ?? 0,
    questionOrder: r.question.order + 1,
    questionPrompt: r.question.prompt,
    questionType: r.question.type,
    value: r.option?.label ?? r.valueText ?? (r.valueNumber != null ? String(r.valueNumber) : ""),
    createdAt: r.createdAt.toISOString(),
  }));
}
