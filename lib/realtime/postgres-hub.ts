import "server-only";
import { Client } from "pg";
import type { RealtimeHub } from "./hub";
import type { RealtimeEvent } from "./events";

// Postgres NOTIFY payloads are capped at 8000 bytes. Roomtone's events
// (option counts, a page of word-cloud words, Q&A items) sit comfortably
// under that for classroom-sized sessions; a payload over the limit would
// fail the NOTIFY outright rather than truncate silently.
const PG_CHANNEL = "roomtone_events";

/**
 * Cross-process realtime fan-out for horizontally-scaled deployments — the
 * default in-memory hub (lib/realtime/hub.ts) only reaches subscribers in
 * its own process, which breaks the moment Roomtone runs behind a load
 * balancer with more than one container: a participant's response could
 * land on container A while the presenter's SSE connection is held open on
 * container B, and A's in-memory EventEmitter has no way to reach B.
 * Postgres LISTEN/NOTIFY solves that by using the database itself as the
 * message bus every container is already connected to.
 *
 * Selected via REALTIME_ADAPTER=postgres (see hub.ts) — off by default
 * because a single-container deployment doesn't need the extra connection,
 * and NOTIFY payloads add a small amount of latency and DB load that an
 * in-process EventEmitter avoids entirely.
 */
class PostgresHub implements RealtimeHub {
  private listeners = new Map<string, Set<(event: RealtimeEvent) => void>>();
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;

  private async ensureConnected(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is not set — required for the postgres realtime adapter.");
      }
      const client = new Client({ connectionString });
      await client.connect();
      await client.query(`LISTEN ${PG_CHANNEL}`);

      client.on("notification", (msg) => {
        if (msg.channel !== PG_CHANNEL || !msg.payload) return;
        let parsed: { channel: string; event: RealtimeEvent };
        try {
          parsed = JSON.parse(msg.payload);
        } catch {
          return; // malformed payload — nothing sensible to do but drop it
        }
        const subs = this.listeners.get(parsed.channel);
        if (subs) for (const listener of subs) listener(parsed.event);
      });

      // A dropped connection (network blip, DB restart) needs a fresh
      // client on the next publish/subscribe — null it out so
      // ensureConnected() reconnects rather than reusing a dead client.
      client.on("error", () => {
        this.client = null;
      });

      this.client = client;
      return client;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async publish(channel: string, event: RealtimeEvent): Promise<void> {
    const client = await this.ensureConnected();
    // pg_notify(), not string-interpolated NOTIFY: this parametrizes both
    // the channel and payload safely, and — unlike a literal NOTIFY
    // statement — doesn't choke on payloads containing quotes.
    await client.query("SELECT pg_notify($1, $2)", [PG_CHANNEL, JSON.stringify({ channel, event })]);
  }

  subscribe(channel: string, listener: (event: RealtimeEvent) => void): () => void {
    this.ensureConnected().catch(() => {
      // Connection failures surface on the next publish/subscribe attempt
      // instead — a subscribe-time failure shouldn't throw inside what
      // callers treat as a synchronous registration.
    });
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
    };
  }
}

export function createPostgresHub(): RealtimeHub {
  return new PostgresHub();
}
