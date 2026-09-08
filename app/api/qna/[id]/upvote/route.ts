import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hub } from "@/lib/realtime/hub";
import { getQnaItems } from "@/lib/qna/queries";

const upvoteSchema = z.object({
  code: z.string().trim().min(1).max(20),
  token: z.string().trim().min(1).max(200),
});

/** Toggles this participant's upvote on a Q&A item — a second call from the same participant removes it, rather than stacking. */
export async function POST(request: Request, ctx: RouteContext<"/api/qna/[id]/upvote">) {
  const { id: qnaItemId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = upvoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { code, token } = parsed.data;
  const normalizedCode = code.toUpperCase();

  const session = await prisma.session.findUnique({
    where: { code: normalizedCode },
    select: { id: true, state: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Unknown session code." }, { status: 404 });
  }
  if (session.state === "ENDED") {
    return NextResponse.json({ error: "This session has ended." }, { status: 409 });
  }

  // Ownership check: the Q&A item must belong to *this* session, not just
  // exist somewhere — otherwise a crafted request could upvote items in an
  // unrelated session it guessed the id of.
  const qnaItem = await prisma.qnaItem.findFirst({ where: { id: qnaItemId, sessionId: session.id } });
  if (!qnaItem) {
    return NextResponse.json({ error: "Unknown question." }, { status: 404 });
  }

  const participant = await prisma.participant.upsert({
    where: { sessionId_token: { sessionId: session.id, token } },
    update: {},
    create: { sessionId: session.id, token },
  });

  const existingUpvote = await prisma.qnaUpvote.findUnique({
    where: { qnaItemId_participantId: { qnaItemId, participantId: participant.id } },
  });

  let upvoted: boolean;
  if (existingUpvote) {
    await prisma.$transaction([
      prisma.qnaUpvote.delete({ where: { id: existingUpvote.id } }),
      prisma.qnaItem.update({ where: { id: qnaItemId }, data: { upvotes: { decrement: 1 } } }),
    ]);
    upvoted = false;
  } else {
    await prisma.$transaction([
      prisma.qnaUpvote.create({ data: { qnaItemId, participantId: participant.id } }),
      prisma.qnaItem.update({ where: { id: qnaItemId }, data: { upvotes: { increment: 1 } } }),
    ]);
    upvoted = true;
  }

  const items = await getQnaItems(session.id);
  hub.publish(normalizedCode, { type: "qna-update", items });

  return NextResponse.json({ ok: true, upvoted });
}
