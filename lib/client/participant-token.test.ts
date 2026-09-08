import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrCreateParticipantToken } from "./participant-token";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Stands in for the browser globals this module reads, with a swappable `crypto` so each test can model a different context. */
function stubBrowser(cryptoImpl: unknown) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
  vi.stubGlobal("crypto", cryptoImpl);
  return store;
}

/** Fills bytes with a fixed 0xff pattern, so the version/variant masking is verifiable rather than random. */
const insecureContextCrypto = {
  getRandomValues: (arr: Uint8Array) => {
    arr.fill(0xff);
    return arr;
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getOrCreateParticipantToken", () => {
  it("returns null during server-side rendering, rather than throwing", () => {
    // No `window` stub at all: this is the SSR pass of a Client Component.
    expect(getOrCreateParticipantToken("ABC123")).toBeNull();
  });

  it("uses crypto.randomUUID when the page is in a secure context", () => {
    stubBrowser({ randomUUID: () => "11111111-2222-4333-8444-555555555555" });
    expect(getOrCreateParticipantToken("ABC123")).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("still issues a valid v4 UUID when randomUUID is missing", () => {
    // The regression this guards: crypto.randomUUID is exposed *only* in
    // secure contexts, so on any plain-http origin (a LAN IP at a workshop,
    // a reverse proxy without TLS) it's undefined. Calling it there threw
    // and blanked the entire participant page.
    stubBrowser(insecureContextCrypto);
    const token = getOrCreateParticipantToken("ABC123");
    expect(token).toMatch(UUID_V4);
  });

  it("still issues a token when Web Crypto is unavailable entirely", () => {
    stubBrowser({});
    expect(getOrCreateParticipantToken("ABC123")).toMatch(/^fallback-/);
  });

  it("reuses the stored token for the same session code", () => {
    stubBrowser(insecureContextCrypto);
    const first = getOrCreateParticipantToken("ABC123");
    expect(getOrCreateParticipantToken("ABC123")).toBe(first);
    // Case-insensitively, since the code comes off a URL a human may have typed.
    expect(getOrCreateParticipantToken("abc123")).toBe(first);
  });

  it("scopes tokens per session, so joining another session is an unlinked identity", () => {
    const store = stubBrowser({
      getRandomValues: (arr: Uint8Array) => {
        // Distinct bytes per call, so the two sessions can't coincidentally match.
        arr.fill(store.size + 1);
        return arr;
      },
    });
    expect(getOrCreateParticipantToken("ABC123")).not.toBe(getOrCreateParticipantToken("ZZZ999"));
  });
});
