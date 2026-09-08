import { prisma } from "@/lib/db/client";
import { hub } from "@/lib/realtime/hub";
import { computeQuestionAggregate, countParticipants } from "@/lib/realtime/aggregate";
import { getQnaItems } from "@/lib/qna/queries";
import type { RealtimeEvent } from "@/lib/realtime/events";

// Long-lived stream — must never be prerendered or cached.
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 20_000;

function encodeEvent(event: RealtimeEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Server-Sent Events stream for one session, keyed by join code. Both the
 * presenter Stage and every participant phone connect here — one-directional
 * (server → client) is exactly the shape this app needs, since writes go
 * through separate POST endpoints (/api/join, /api/respond). See
 * lib/realtime/hub.ts for the pub/sub layer this subscribes to.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/live/[code]">) {
  const { code } = await ctx.params;
  const normalizedCode = code.toUpperCase();

  const session = await prisma.session.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      state: true,
      activeQuestionId: true,
      deck: { select: { questions: { select: { id: true }, orderBy: { order: "asc" } } } },
    },
  });
  if (!session) {
    return new Response("Unknown session code.", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // Controller already closed (client disconnected between events) —
          // cleanup() below will have run or is about to; nothing else to do.
        }
      };

      // Initial snapshot: a client that just connected (fresh page load, or
      // reconnect after a network blip) needs full current state, not just
      // future deltas.
      send({ type: "session-state", state: session.state, activeQuestionId: session.activeQuestionId });
      send({ type: "participant-count", count: await countParticipants(session.id) });
      for (const q of session.deck.questions) {
        const aggregate = await computeQuestionAggregate(session.id, q.id);
        if (aggregate) send({ type: "question-update", questionId: q.id, aggregate });
      }
      send({ type: "qna-update", items: await getQnaItems(session.id) });

      unsubscribe = hub.subscribe(normalizedCode, send);

      // Comment lines (":...") are valid SSE and ignored by EventSource —
      // used purely to keep intermediary proxies from timing out an
      // apparently-idle connection.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // stream already closed; cleanup() handles clearing this interval.
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    unsubscribe?.();
    if (heartbeat) clearInterval(heartbeat);
  }
  request.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering, if ever deployed behind it
    },
  });
}
