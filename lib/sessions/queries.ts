import "server-only";
import { prisma } from "@/lib/db/client";

/** Returns null if the session doesn't exist or isn't owned by this user, callers should treat that as notFound(). */
export function getSessionForUser(sessionId: string, userId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: {
      deck: {
        select: {
          id: true,
          title: true,
          questions: { orderBy: { order: "asc" }, select: { id: true, prompt: true, type: true } },
        },
      },
      _count: { select: { participants: true } },
    },
  });
}

/**
 * Public — no ownership check, deliberately. This is what /j/[code] reads:
 * anyone with the code (i.e. anyone who scanned the QR) can look up the
 * session, regardless of its state — a DRAFT session should still show a
 * "waiting for the host to start" screen rather than a 404.
 */
export function getSessionForParticipant(code: string) {
  return prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    select: {
      id: true,
      code: true,
      state: true,
      activeQuestionId: true,
      deck: {
        select: {
          title: true,
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
}

/** Full data the presenter Stage needs on first paint — everything after that arrives over SSE. Returns null if the session doesn't exist or isn't owned by this user. */
export function getSessionForStage(sessionId: string, userId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: {
      deck: {
        select: {
          id: true,
          title: true,
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
      _count: { select: { participants: true } },
    },
  });
}
