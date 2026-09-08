import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/client";
import { buildJoinUrl } from "@/lib/config/site";

// Public endpoint — the whole point is that a phone with no session cookie
// can load this from the projector. It only encodes a join URL, nothing
// sensitive, so no auth check beyond "does this code exist" is needed.
export async function GET(_request: Request, ctx: RouteContext<"/api/qr/[code]">) {
  const { code } = await ctx.params;

  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Unknown session code." }, { status: 404 });
  }

  // Solid white background, not transparent: this same SVG gets placed on
  // both a light surface (console lobby) and the navy Stage. Transparent
  // "light" modules meant the QR only had contrast on a light backdrop —
  // on the Stage's navy background the dark modules (#08172a) nearly
  // matched the background they were sitting on. A QR's quiet zone is
  // supposed to be light regardless of context anyway — that's what real
  // scanners expect, not just a look.
  const svg = await QRCode.toString(buildJoinUrl(code.toUpperCase()), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#08172a", light: "#ffffff" },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Codes are short-lived per presentation, but stable for their
      // lifetime — safe to let a browser cache this for a few minutes.
      "Cache-Control": "public, max-age=300",
    },
  });
}
