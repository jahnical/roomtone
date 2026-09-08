import { randomBytes } from "node:crypto";

// Excludes visually ambiguous characters (0/O, 1/I/L) since this code gets
// read off a projector screen and typed on a phone keyboard as a fallback
// to scanning the QR.
const SESSION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SESSION_CODE_LENGTH = 6;

export function generateSessionCode(): string {
  const bytes = randomBytes(SESSION_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += SESSION_CODE_ALPHABET[bytes[i] % SESSION_CODE_ALPHABET.length];
  }
  return code;
}

/** Opaque per-participant identifier. Generated client-side too (see lib/client/participant.ts) — this server copy exists for tests and any server-issued fallback. */
export function generateParticipantToken(): string {
  return randomBytes(16).toString("base64url");
}
