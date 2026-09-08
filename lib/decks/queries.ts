import "server-only";
import { prisma } from "@/lib/db/client";

export function getDecksForUser(userId: string) {
  return prisma.deck.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { questions: true, sessions: true } },
    },
  });
}

/** Returns null if the deck doesn't exist or isn't owned by this user — callers should treat that as notFound(). */
export function getDeckWithQuestions(deckId: string, userId: string) {
  return prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: { orderBy: { order: "asc" } },
          pairedWith: { select: { id: true, prompt: true } },
        },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, code: true, state: true, createdAt: true },
      },
    },
  });
}
