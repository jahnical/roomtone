import "server-only";
import { prisma } from "@/lib/db/client";
import { computeOptionShift, computeScaleShift, type OptionShiftSummary, type ScaleShiftSummary } from "./shift";

export type PairingResult =
  | { kind: "MULTIPLE_CHOICE"; beforePrompt: string; afterPrompt: string; shift: OptionShiftSummary }
  | { kind: "SCALE"; beforePrompt: string; afterPrompt: string; shift: ScaleShiftSummary }
  | { kind: "unavailable" };

/**
 * Joins the "before" and "after" questions of a pair by participant token
 * (see Response.participantId / Participant.token) within one session, and
 * hands the raw pairs to lib/insight/shift.ts — this file is just the DB
 * plumbing around that pure function. Only MULTIPLE_CHOICE and SCALE pairs
 * are supported since those are the only types with a meaningful "moved
 * from X to Y" reading.
 */
export async function computePairingForQuestion(sessionId: string, afterQuestionId: string): Promise<PairingResult> {
  const afterQuestion = await prisma.question.findUnique({
    where: { id: afterQuestionId },
    include: { pairedWith: true },
  });
  if (!afterQuestion?.pairedWith || afterQuestion.type !== afterQuestion.pairedWith.type) {
    return { kind: "unavailable" };
  }
  const beforeQuestion = afterQuestion.pairedWith;

  if (afterQuestion.type === "MULTIPLE_CHOICE") {
    const [beforeResponses, afterResponses] = await Promise.all([
      prisma.response.findMany({
        where: { sessionId, questionId: beforeQuestion.id, optionId: { not: null } },
        include: { option: true },
      }),
      prisma.response.findMany({
        where: { sessionId, questionId: afterQuestion.id, optionId: { not: null } },
        include: { option: true },
      }),
    ]);
    const toPairs = (rows: typeof beforeResponses) =>
      rows.filter((r) => r.option).map((r) => ({ participantId: r.participantId, optionLabel: r.option!.label }));

    return {
      kind: "MULTIPLE_CHOICE",
      beforePrompt: beforeQuestion.prompt,
      afterPrompt: afterQuestion.prompt,
      shift: computeOptionShift(toPairs(beforeResponses), toPairs(afterResponses)),
    };
  }

  if (afterQuestion.type === "SCALE") {
    const [beforeResponses, afterResponses] = await Promise.all([
      prisma.response.findMany({ where: { sessionId, questionId: beforeQuestion.id, valueNumber: { not: null } } }),
      prisma.response.findMany({ where: { sessionId, questionId: afterQuestion.id, valueNumber: { not: null } } }),
    ]);
    const toPairs = (rows: typeof beforeResponses) =>
      rows.map((r) => ({ participantId: r.participantId, value: r.valueNumber as number }));

    return {
      kind: "SCALE",
      beforePrompt: beforeQuestion.prompt,
      afterPrompt: afterQuestion.prompt,
      shift: computeScaleShift(toPairs(beforeResponses), toPairs(afterResponses)),
    };
  }

  return { kind: "unavailable" };
}
