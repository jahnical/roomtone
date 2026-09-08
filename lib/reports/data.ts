import "server-only";
import type { SessionState } from "@prisma/client";
import { getSessionForStage } from "@/lib/sessions/queries";
import { computeQuestionAggregate } from "@/lib/realtime/aggregate";
import { computeLiveInsight, type LiveInsight } from "@/lib/insight/live";
import { computePairingForQuestion, type PairingResult } from "@/lib/insight/pairing-query";
import { getQnaItems } from "@/lib/qna/queries";
import type { QuestionAggregate, QnaItemPayload } from "@/lib/realtime/events";
import type { QuestionTypeValue } from "@/lib/validation/deck";

export interface SessionReportQuestion {
  id: string;
  order: number;
  prompt: string;
  type: QuestionTypeValue;
  options: { id: string; label: string }[];
  config: { min?: number; max?: number; minLabel?: string; maxLabel?: string };
  pairedWithId: string | null;
  aggregate: QuestionAggregate | null;
  insight: LiveInsight;
  pairing: PairingResult | null;
}

export interface SessionReportData {
  sessionId: string;
  code: string;
  state: SessionState;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  deckId: string;
  deckTitle: string;
  questions: SessionReportQuestion[];
  qnaItems: QnaItemPayload[];
}

/** Everything the report page and both export routes need, fetched once — the single source of truth for "what happened in this session." Returns null if the session doesn't exist or isn't owned by this user. */
export async function getSessionReportData(sessionId: string, userId: string): Promise<SessionReportData | null> {
  const session = await getSessionForStage(sessionId, userId);
  if (!session) return null;

  const participantCount = session._count.participants;

  const questions: SessionReportQuestion[] = await Promise.all(
    session.deck.questions.map(async (q) => {
      const aggregate = await computeQuestionAggregate(sessionId, q.id);
      const config = q.config as SessionReportQuestion["config"];
      const insight = computeLiveInsight(
        { type: q.type, options: q.options.map((o) => ({ id: o.id, label: o.label })) },
        aggregate ?? undefined,
        participantCount,
      );
      const pairing = q.pairedWithId ? await computePairingForQuestion(sessionId, q.id) : null;

      return {
        id: q.id,
        order: q.order,
        prompt: q.prompt,
        type: q.type,
        options: q.options.map((o) => ({ id: o.id, label: o.label })),
        config,
        pairedWithId: q.pairedWithId,
        aggregate,
        insight,
        pairing,
      };
    }),
  );

  const qnaItems = await getQnaItems(sessionId);

  return {
    sessionId: session.id,
    code: session.code,
    state: session.state,
    createdAt: session.createdAt.toISOString(),
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    participantCount,
    deckId: session.deck.id,
    deckTitle: session.deck.title,
    questions,
    qnaItems,
  };
}
