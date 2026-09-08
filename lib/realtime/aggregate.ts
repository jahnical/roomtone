import "server-only";
import { prisma } from "@/lib/db/client";
import { tokenize } from "@/lib/insight/text/normalize";
import type { QuestionAggregate } from "./events";

const WORD_CLOUD_MAX_WORDS = 60;
const OPEN_TEXT_MAX_RESPONSES = 200;

interface ScaleConfig {
  min?: number;
  max?: number;
}

/**
 * Recomputes the full current aggregate for one question within one
 * session, straight from the Response table — no caching, since M3's
 * write volume (a classroom, not a stadium) doesn't need it yet.
 *
 * sessionId is required, not optional: a Question belongs to a Deck, and
 * a Deck can be presented across many Sessions (the same "Week 3
 * check-in" deck run again next term). Filtering by questionId alone
 * would mix responses from every past run of this question into "live"
 * numbers for the current one. Returns null if the question doesn't exist.
 */
export async function computeQuestionAggregate(sessionId: string, questionId: string): Promise<QuestionAggregate | null> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });
  if (!question) return null;

  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      const [counts, responses] = await Promise.all([
        prisma.response.groupBy({
          by: ["optionId"],
          where: { sessionId, questionId, optionId: { not: null } },
          _count: { _all: true },
        }),
        prisma.response.findMany({
          where: { sessionId, questionId, optionId: { not: null } },
          select: { createdAt: true },
        }),
      ]);
      const countByOption = new Map(counts.map((c) => [c.optionId, c._count._all]));
      const options = question.options.map((o) => ({
        optionId: o.id,
        label: o.label,
        count: countByOption.get(o.id) ?? 0,
      }));
      return {
        type: "MULTIPLE_CHOICE",
        total: options.reduce((sum, o) => sum + o.count, 0),
        options,
        respondedAt: responses.map((r) => r.createdAt.toISOString()),
      };
    }

    case "WORD_CLOUD": {
      const responses = await prisma.response.findMany({
        where: { sessionId, questionId },
        select: { valueText: true, createdAt: true },
      });
      const frequency = new Map<string, number>();
      for (const r of responses) {
        if (!r.valueText) continue;
        for (const token of tokenize(r.valueText)) {
          frequency.set(token, (frequency.get(token) ?? 0) + 1);
        }
      }
      const words = Array.from(frequency.entries())
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, WORD_CLOUD_MAX_WORDS);
      return {
        type: "WORD_CLOUD",
        total: responses.length,
        words,
        respondedAt: responses.map((r) => r.createdAt.toISOString()),
      };
    }

    case "OPEN_TEXT": {
      const responses = await prisma.response.findMany({
        where: { sessionId, questionId, valueText: { not: null } },
        select: { id: true, valueText: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: OPEN_TEXT_MAX_RESPONSES,
      });
      return {
        type: "OPEN_TEXT",
        total: responses.length,
        responses: responses.map((r) => ({
          id: r.id,
          text: r.valueText as string,
          createdAt: r.createdAt.toISOString(),
        })),
        respondedAt: responses.map((r) => r.createdAt.toISOString()),
      };
    }

    case "SCALE": {
      const config = question.config as ScaleConfig;
      const min = config.min ?? 1;
      const max = config.max ?? 5;
      const responses = await prisma.response.findMany({
        where: { sessionId, questionId, valueNumber: { not: null } },
        select: { valueNumber: true, createdAt: true },
      });
      const countByValue = new Map<number, number>();
      for (let v = min; v <= max; v++) countByValue.set(v, 0);
      let sum = 0;
      for (const r of responses) {
        const value = r.valueNumber as number;
        countByValue.set(value, (countByValue.get(value) ?? 0) + 1);
        sum += value;
      }
      return {
        type: "SCALE",
        total: responses.length,
        min,
        max,
        mean: responses.length > 0 ? sum / responses.length : null,
        counts: Array.from(countByValue.entries()).map(([value, count]) => ({ value, count })),
        respondedAt: responses.map((r) => r.createdAt.toISOString()),
      };
    }

    case "QNA":
      return { type: "QNA" };
  }
}

export async function countParticipants(sessionId: string): Promise<number> {
  return prisma.participant.count({ where: { sessionId } });
}
