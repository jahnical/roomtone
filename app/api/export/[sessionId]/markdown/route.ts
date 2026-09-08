import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getSessionReportData } from "@/lib/reports/data";
import { buildReportMarkdown } from "@/lib/reports/markdown";

export async function GET(_request: Request, ctx: RouteContext<"/api/export/[sessionId]/markdown">) {
  const { sessionId } = await ctx.params;

  let auth;
  try {
    auth = await requireSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const data = await getSessionReportData(sessionId, auth.userId);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const markdown = buildReportMarkdown(data);

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="roomtone-${data.code}-report.md"`,
    },
  });
}
