import { EventEmitter } from "node:events";
import { createPostgresHub } from "./postgres-hub";
import type { RealtimeEvent } from "./events";

/**
 * Realtime fan-out, behind an adapter interface so the in-process
 * implementation used here in dev/M3 can be swapped for a Postgres
 * LISTEN/NOTIFY-backed adapter in M6 without touching any caller. Callers
 * only ever see `publish`/`subscribe` — never the EventEmitter itself.
 *
 * Channel = a session's join code. Both the presenter Stage and every
 * participant phone know the code (it's in the URL either way), so it's a
 * simpler shared key than the session's database id.
 */
export interface RealtimeHub {
  // Callers never await this (a dropped realtime update shouldn't fail an
  // API request) — Promise<void> exists so the Postgres adapter's NOTIFY
  // query can run without every publish() call site needing to change.
  publish(channel: string, event: RealtimeEvent): void | Promise<void>;
  /** Returns an unsubscribe function. Callers MUST call it when done (e.g. on the SSE request's abort signal) or the in-memory adapter leaks listeners across reconnects. */
  subscribe(channel: string, listener: (event: RealtimeEvent) => void): () => void;
}

class InMemoryHub implements RealtimeHub {
  private emitter = new EventEmitter();

  constructor() {
    // Many concurrent SSE connections can share one channel (every phone in
    // the room); the default 10-listener cap would log spurious warnings.
    this.emitter.setMaxListeners(0);
  }

  publish(channel: string, event: RealtimeEvent) {
    this.emitter.emit(channel, event);
  }

  subscribe(channel: string, listener: (event: RealtimeEvent) => void) {
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }
}

function createHub(): RealtimeHub {
  // The Postgres adapter's class definition has no side effects at import
  // time — it only opens its LISTEN connection when createPostgresHub()
  // is actually called below — so a plain static import is fine even
  // though most deployments never select it.
  if (process.env.REALTIME_ADAPTER === "postgres") {
    return createPostgresHub();
  }
  return new InMemoryHub();
}

// Dev-mode singleton (same rationale as lib/db/client.ts): without this,
// every hot reload would create a fresh EventEmitter with no subscribers,
// silently breaking any already-open SSE connections. Also load-bearing in
// production for the Postgres adapter specifically — without it, every
// module reload would open a new LISTEN connection and never close the old
// one.
const globalForHub = globalThis as unknown as { roomtoneHub: RealtimeHub | undefined };

export const hub: RealtimeHub = globalForHub.roomtoneHub ?? createHub();

globalForHub.roomtoneHub = hub;
