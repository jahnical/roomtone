/**
 * Opaque per-participant identifier, generated in the browser and kept in
 * localStorage — never a name, device id, or anything else identifying.
 * Scoped per session code so re-joining the SAME session reuses the same
 * token (needed so "you already answered X" and, later, pre/post pairing
 * work), while joining a DIFFERENT session gets a fresh, unlinked identity.
 */

/**
 * A v4 UUID, without requiring a secure context.
 *
 * `crypto.randomUUID()` is only exposed on HTTPS origins and localhost. This
 * app is routinely served over plain http:// — a LAN IP during a workshop, or
 * behind a reverse proxy that hasn't got TLS yet — where it is simply
 * undefined, and calling it throws hard enough to blank the whole participant
 * page. `crypto.getRandomValues()` carries no such restriction, so it stands
 * in wherever randomUUID is missing.
 */
function randomToken(): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;

  if (typeof cryptoObj?.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  if (typeof cryptoObj?.getRandomValues === "function") {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    // Stamp the version (4) and variant (RFC 4122) bits so this is a
    // well-formed v4 UUID rather than just 16 random bytes wearing the
    // shape of one.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Nothing from the Web Crypto API is available at all (ancient or very
  // locked-down browser). Math.random is not cryptographically secure, but
  // this token only has to be unguessable-enough to keep two phones in the
  // same room from colliding — it grants no privileges and identifies no
  // one. Degrading here beats refusing to let someone answer a poll.
  return `fallback-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateParticipantToken(code: string): string | null {
  // Returns null during a server-side render pass (this fires from a
  // Client Component's SSR, not just the browser) rather than throwing —
  // callers use the standard lazy-ref-init pattern, which naturally
  // retries this on the client's first real render once window exists.
  if (typeof window === "undefined") return null;

  const key = `roomtone:participant:${code.toUpperCase()}`;
  let token = window.localStorage.getItem(key);
  if (!token) {
    token = randomToken();
    window.localStorage.setItem(key, token);
  }
  return token;
}
