import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hub } from "@/lib/realtime/hub";
import { getQnaItems } from "@/lib/qna/queries";

const createQnaSchema = z.object({
  code: z.string().trim().min(1).max(20),
  token: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(300),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createQnaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid question." }, { status: 400 });
  }
  const { code, token, text } = parsed.data;
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

  const participant = await prisma.participant.upsert({
    where: { sessionId_token: { sessionId: session.id, token } },
    update: {},
    create: { sessionId: session.id, token },
  });

  const created = await prisma.qnaItem.create({
    data: { sessionId: session.id, participantId: participant.id, text },
  });

  const items = await getQnaItems(session.id);
  hub.publish(normalizedCode, { type: "qna-update", items });

  return NextResponse.json({ ok: true, id: created.id });
}
