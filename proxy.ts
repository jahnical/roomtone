import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/jwt";
import { BASE_PATH } from "@/lib/config/base-path";

// Everything under the presenter console requires a logged-in user.
// Participant routes (/j/*), the marketing/home page, auth pages, and the
// public /api/qr, /api/live, /api/respond endpoints are intentionally left
// open — students never authenticate.
//
// Note: Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`
// (same mechanics, new name/export) — see node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md. Proxy now defaults to the
// Node.js runtime rather than Edge, but we still avoid next/headers here
// since request.cookies is the documented way to read cookies in proxy.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    // request.url/request.nextUrl are already basePath-stripped by Next
    // (matcher patterns above are written the same way, without the
    // prefix) — but this constructs a literal redirect URL by hand, which
    // isn't a basePath-aware API the way next/link or redirect() are, so
    // the prefix has to go on explicitly or this redirects to a 404.
    const loginUrl = new URL(`${BASE_PATH}/login`, request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // /present is the full-screen Stage — also presenter-only, just deliberately
  // outside the /console layout so it doesn't inherit the admin chrome.
  matcher: ["/console/:path*", "/present/:path*"],
};
