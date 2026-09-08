import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { computePairingForQuestion } from "@/lib/insight/pairing-query";

/** Presenter-only (this is Stage-detail data, not something a participant needs). */
export async function GET(_request: Request, ctx: RouteContext<"/api/pairing/[sessionId]/[questionId]">) {
  const { sessionId, questionId } = await ctx.params;

  let auth;
  try {
    auth = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const owned = await prisma.session.findFirst({ where: { id: sessionId, userId: auth.userId } });
  if (!owned) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await computePairingForQuestion(sessionId, questionId);
  return NextResponse.json(result);
}
