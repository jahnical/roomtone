// Deliberately has no "server-only" / next/headers imports: this module is
// shared between Server Components (lib/auth/session.ts) and middleware.ts,
// which runs in the Edge runtime and cannot use next/headers' cookies().

import { SignJWT, jwtVerify } from "jose";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a random 32+ byte value in .env (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string"
    ) {
      return { userId: payload.userId, email: payload.email, name: payload.name };
    }
    return null;
  } catch {
    // Expired, malformed, or forged — treat identically to "not logged in".
    return null;
  }
}

export const SESSION_COOKIE_NAME = "roomtone_session";
export const SESSION_COOKIE_MAX_AGE = SESSION_DURATION_SECONDS;
