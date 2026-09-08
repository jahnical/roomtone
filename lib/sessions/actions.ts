"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { generateSessionCode } from "@/lib/auth/codes";
import { hub } from "@/lib/realtime/hub";
import { getQnaItems } from "@/lib/qna/queries";

const MAX_CODE_ATTEMPTS = 8;

export async function createSessionForDeck(deckId: string) {
  const session = await requireSession();
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: session.userId },
    include: { _count: { select: { questions: true } } },
  });
  if (!deck) {
    throw new Error("NOT_FOUND");
  }
  if (deck._count.questions === 0) {
    throw new Error("Add at least one question before creating a session.");
  }

  // Collision odds on a 6-char, ~32-symbol alphabet are astronomically low,
  // but the code column is unique so we retry on the rare clash rather than
  // trusting randomness alone.
  // redirect() works by throwing a special NEXT_REDIRECT error, so it's kept
  // outside the try/catch below — catching it alongside the create() call
  // would risk misclassifying it as a retryable Prisma error.
  let createdId: string | null = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !createdId; attempt++) {
    const code = generateSessionCode();
    try {
      const created = await prisma.session.create({
        data: { deckId, userId: session.userId, code },
      });
      createdId = created.id;
    } catch (err) {
      const isUniqueViolation =
        typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
      if (!isUniqueViolation) throw err;
    }
  }
  if (!createdId) {
    throw new Error("Could not allocate a session code, please try again.");
  }
  redirect(`/console/sessions/${createdId}`);
}

async function requireSessionOwnership(sessionId: string, userId: string) {
  const owned = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: { deck: { include: { questions: { orderBy: { order: "asc" }, select: { id: true } } } } },
  });
  if (!owned) {
    throw new Error("NOT_FOUND");
  }
  return owned;
}

export async function startSession(sessionId: string) {
  const auth = await requireSession();
  const target = await requireSessionOwnership(sessionId, auth.userId);

  if (target.state === "ENDED") {
    throw new Error("This session has already ended.");
  }
  if (target.state === "LIVE") {
    redirect(`/present/${sessionId}`);
  }

  const activeQuestionId = target.activeQuestionId ?? target.deck.questions[0]?.id ?? null;
  await prisma.session.update({
    where: { id: sessionId },
    data: { state: "LIVE", startedAt: new Date(), activeQuestionId },
  });
  hub.publish(target.code, { type: "session-state", state: "LIVE", activeQuestionId });

  redirect(`/present/${sessionId}`);
}

/**
 * Opens (or closes, with questionId: null) a specific question for
 * responses, independent of next/prev order and independent of the Stage
 * being presented at all. This is what lets a presenter open just one
 * question from the session lobby, collect answers over however long they
 * want, then come back later and open a different one, without ever
 * clicking "Start presenting" for that round.
 */
export async function setActiveQuestion(sessionId: string, questionId: string | null) {
  const auth = await requireSession();
  const target = await requireSessionOwnership(sessionId, auth.userId);

  if (questionId !== null && !target.deck.questions.some((q) => q.id === questionId)) {
    throw new Error("Unknown question.");
  }

  await prisma.session.update({ where: { id: sessionId }, data: { activeQuestionId: questionId } });
  hub.publish(target.code, { type: "session-state", state: target.state, activeQuestionId: questionId });
}

export async function advanceQuestion(sessionId: string, direction: "next" | "prev") {
  const auth = await requireSession();
  const target = await requireSessionOwnership(sessionId, auth.userId);

  const questions = target.deck.questions;
  const currentIndex = target.activeQuestionId
    ? questions.findIndex((q) => q.id === target.activeQuestionId)
    : -1;
  const nextIndex =
    direction === "next"
      ? Math.min(questions.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
  const nextQuestionId = questions[nextIndex]?.id ?? null;

  await prisma.session.update({ where: { id: sessionId }, data: { activeQuestionId: nextQuestionId } });
  hub.publish(target.code, { type: "session-state", state: target.state, activeQuestionId: nextQuestionId });
}

export async function endSession(sessionId: string) {
  const auth = await requireSession();
  const target = await requireSessionOwnership(sessionId, auth.userId);

  await prisma.session.update({
    where: { id: sessionId },
    data: { state: "ENDED", endedAt: new Date() },
  });
  hub.publish(target.code, { type: "session-state", state: "ENDED", activeQuestionId: target.activeQuestionId });

  redirect(`/console/sessions/${sessionId}`);
}

/** Presenter-only — participants can submit and upvote (see app/api/qna/*) but only the presenter can mark a question as handled. */
export async function toggleQnaAnswered(sessionId: string, qnaItemId: string) {
  const auth = await requireSession();
  const target = await requireSessionOwnership(sessionId, auth.userId);

  const item = await prisma.qnaItem.findFirst({ where: { id: qnaItemId, sessionId } });
  if (!item) {
    throw new Error("NOT_FOUND");
  }

  await prisma.qnaItem.update({ where: { id: qnaItemId }, data: { answered: !item.answered } });

  const items = await getQnaItems(sessionId);
  hub.publish(target.code, { type: "qna-update", items });
}

export async function deleteSession(sessionId: string) {
  const session = await requireSession();
  const owned = await prisma.session.findFirst({
    where: { id: sessionId, userId: session.userId },
  });
  if (!owned) {
    throw new Error("NOT_FOUND");
  }
  await prisma.session.delete({ where: { id: sessionId } });
  redirect(`/console/decks/${owned.deckId}`);
}
