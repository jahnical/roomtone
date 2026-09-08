import "server-only";

import { cookies } from "next/headers";
import { getPublicBaseUrl } from "@/lib/config/site";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./jwt";

export type { SessionPayload };

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Tied to whether this deployment is actually reachable over HTTPS
    // (PUBLIC_BASE_URL), not just NODE_ENV. A Secure cookie is never sent
    // over a plain-http connection at all — if the reverse proxy in front
    // doesn't (yet) terminate real TLS, gating this on NODE_ENV===
    // "production" alone silently makes every session cookie unusable
    // rather than failing loudly.
    secure: getPublicBaseUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function readSessionFromCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Throws for Server Components / route handlers that require a logged-in presenter. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await readSessionFromCookie();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
