/**
 * Opaque per-participant identifier, generated in the browser and kept in
 * localStorage — never a name, device id, or anything else identifying.
 * Scoped per session code so re-joining the SAME session reuses the same
 * token (needed so "you already answered X" and, later, pre/post pairing
 * work), while joining a DIFFERENT session gets a fresh, unlinked identity.
 */
export function getOrCreateParticipantToken(code: string): string | null {
  // Returns null during a server-side render pass (this fires from a
  // Client Component's SSR, not just the browser) rather than throwing —
  // callers use the standard lazy-ref-init pattern, which naturally
  // retries this on the client's first real render once window exists.
  if (typeof window === "undefined") return null;

  const key = `roomtone:participant:${code.toUpperCase()}`;
  let token = window.localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem(key, token);
  }
  return token;
}
