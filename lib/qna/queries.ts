import "server-only";
import { prisma } from "@/lib/db/client";
import type { QnaItemPayload } from "@/lib/realtime/events";

/** Sorted by upvotes desc (what the presenter actually wants to see first), then oldest-first among ties. */
export async function getQnaItems(sessionId: string): Promise<QnaItemPayload[]> {
  const items = await prisma.qnaItem.findMany({
    where: { sessionId },
    orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
  });
  return items.map((item) => ({
    id: item.id,
    text: item.text,
    upvotes: item.upvotes,
    answered: item.answered,
    createdAt: item.createdAt.toISOString(),
  }));
}
