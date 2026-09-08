import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hub } from "@/lib/realtime/hub";
import { countParticipants } from "@/lib/realtime/aggregate";

const joinSchema = z.object({
  code: z.string().trim().min(1).max(20),
  // Generated client-side (crypto.randomUUID()) and persisted in
  // localStorage — see app/j/[code]/participant-room.tsx. Never anything
  // identifying; just an opaque key so re-joining the same session reuses
  // the same Participant row instead of creating a duplicate.
  token: z.string().trim().min(1).max(200),
  nickname: z.string().trim().max(60).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join request." }, { status: 400 });
  }
  const { code, token, nickname } = parsed.data;
  const normalizedCode = code.toUpperCase();

  const session = await prisma.session.findUnique({
    where: { code: normalizedCode },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Unknown session code." }, { status: 404 });
  }

  const { participant, created } = await prisma.$transaction(async (tx) => {
    const existing = await tx.participant.findUnique({
      where: { sessionId_token: { sessionId: session.id, token } },
    });
    if (existing) {
      return { participant: existing, created: false };
    }
    const created = await tx.participant.create({
      data: { sessionId: session.id, token, nickname },
    });
    return { participant: created, created: true };
  });

  if (created) {
    hub.publish(normalizedCode, { type: "participant-count", count: await countParticipants(session.id) });
  }

  return NextResponse.json({ ok: true, participantId: participant.id });
}
