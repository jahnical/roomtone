import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { getRawResponseRows } from "@/lib/reports/raw";
import { buildResponsesCsv } from "@/lib/reports/csv";

export async function GET(_request: Request, ctx: RouteContext<"/api/export/[sessionId]/csv">) {
  const { sessionId } = await ctx.params;

  let auth;
  try {
    auth = await requireSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const owned = await prisma.session.findFirst({
    where: { id: sessionId, userId: auth.userId },
    select: { code: true },
  });
  if (!owned) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rows = await getRawResponseRows(sessionId);
  const csv = buildResponsesCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roomtone-${owned.code}-responses.csv"`,
    },
  });
}
