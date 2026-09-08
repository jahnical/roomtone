/**
 * scripts/simulate.ts — a virtual classroom for testing and demoing
 * Roomtone without needing real people in the room. Joins N simulated
 * participants to a LIVE session and has them answer whatever question is
 * currently active, with staggered arrival timing and a configurable
 * answer distribution — this is the load-bearing check for the insight
 * engine (M4): run with --distribution=split on a multiple-choice
 * question and confirm the Stage's room-state strip actually says "The
 * room is split," rather than trusting the math from unit tests alone.
 *
 * Usage:
 *   npm run simulate -- --code=ABC123 --count=25 --distribution=split
 *
 * Options:
 *   --code           session join code (required)
 *   --count          number of simulated participants (default 25)
 *   --distribution   even | split | consensus (default even)
 *   --base-url       app base URL (default http://localhost:3000)
 *   --spread-ms      max jitter before a response lands, in ms (default 8000)
 *
 * Writes go through the same public HTTP endpoints a real phone uses
 * (/api/join, /api/respond, /api/qna) — this is exercising the real
 * request path, not writing to the database directly. Reads (deck
 * structure, which question is active) go straight through Prisma since
 * this is a local dev/demo tool, not a participant.
 *
 * Run it once, then advance the presenter's Stage to the next question
 * and run it again for that question.
 */

// Next's dev server auto-loads .env; a plain `tsx` invocation doesn't, so
// this needs to happen before the `prisma` import below establishes its
// DATABASE_URL-dependent connection.
import "dotenv/config";
import { prisma } from "../lib/db/client";

type Distribution = "even" | "split" | "consensus";

interface Args {
  code: string;
  count: number;
  baseUrl: string;
  spreadMs: number;
  distribution: Distribution;
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (const arg of argv) {
    const match = arg.match(/^--([\w-]+)=(.*)$/);
    if (match) map.set(match[1], match[2]);
  }

  const code = map.get("code");
  if (!code) {
    console.error(
      "Usage: npm run simulate -- --code=ABC123 [--count=25] [--distribution=even|split|consensus] [--base-url=http://localhost:3000] [--spread-ms=8000]",
    );
    process.exit(1);
  }

  const distribution = (map.get("distribution") ?? "even") as Distribution;
  if (!["even", "split", "consensus"].includes(distribution)) {
    console.error(`Unknown --distribution "${distribution}" — expected even, split, or consensus.`);
    process.exit(1);
  }

  return {
    code: code.toUpperCase(),
    count: Number(map.get("count") ?? 25),
    baseUrl: map.get("base-url") ?? "http://localhost:3000",
    spreadMs: Number(map.get("spread-ms") ?? 8000),
    distribution,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const WORD_BANK = [
  "exciting", "productive", "chaotic", "focused", "overwhelming", "steady",
  "ambitious", "tight", "collaborative", "intense", "smooth", "uncertain",
  "energizing", "draining", "promising", "rushed",
];

const SENTENCE_BANK = [
  "unclear requirements from stakeholders",
  "not enough time to test properly",
  "waiting on design review",
  "scope keeps expanding mid-sprint",
  "great collaboration across the team",
  "blocked on a third-party API",
  "communication gaps between teams",
  "tooling issues slowing everyone down",
];

function pickMultipleChoiceOptionId(options: { id: string }[], distribution: Distribution): string {
  const n = options.length;
  if (n === 0) throw new Error("Question has no options.");
  if (n === 1) return options[0].id;

  const roll = Math.random();

  if (distribution === "consensus") {
    // ~85% pick option 0, remainder spread across the rest.
    return roll < 0.85 ? options[0].id : options[randomInt(1, n - 1)].id;
  }

  if (distribution === "split") {
    // ~45/45 across the first two options, remainder (if any) shared by the rest.
    if (roll < 0.45) return options[0].id;
    if (roll < 0.9) return options[1].id;
    return n > 2 ? options[randomInt(2, n - 1)].id : options[randomInt(0, 1)].id;
  }

  return options[randomInt(0, n - 1)].id;
}

function pickScaleValue(min: number, max: number, distribution: Distribution): number {
  if (distribution === "split") {
    // Bimodal: cluster near the ends, almost nothing in the middle.
    const nearMin = Math.random() < 0.5;
    const base = nearMin ? min : max;
    const jitter = Math.random() < 0.7 ? 0 : nearMin ? 1 : -1;
    return Math.min(max, Math.max(min, base + jitter));
  }
  if (distribution === "consensus") {
    // Clustered around the middle.
    const mid = (min + max) / 2;
    return Math.min(max, Math.max(min, Math.round(mid + randomInt(-1, 1))));
  }
  return randomInt(min, max);
}

function pickText(bank: string[], distribution: Distribution): string {
  // Narrowing the pool (and re-picking from it repeatedly) is what
  // produces repeated phrasing for clusterResponses() to find — a
  // "split"/"consensus" run with the full random bank would just look
  // like an "even" run once TF-IDF clustering sees it.
  if (distribution === "consensus") return bank[randomInt(0, 1)];
  if (distribution === "split") return bank[randomInt(0, 3)];
  return bank[randomInt(0, bank.length - 1)];
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const session = await prisma.session.findUnique({
    where: { code: args.code },
    include: {
      deck: {
        select: {
          title: true,
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!session) {
    console.error(`No session found with code ${args.code}.`);
    process.exit(1);
  }
  if (session.state !== "LIVE") {
    console.error(`Session ${args.code} is ${session.state}, not LIVE — start presenting first.`);
    process.exit(1);
  }
  const question = session.deck.questions.find((q) => q.id === session.activeQuestionId);
  if (!question) {
    console.error("No question is currently active on the Stage — advance to a question first.");
    process.exit(1);
  }

  console.log(
    `Simulating ${args.count} participants for "${session.deck.title}" — Q: "${question.prompt}" (${question.type}, ${args.distribution} distribution)`,
  );

  const tokens = Array.from({ length: args.count }, () => crypto.randomUUID());

  // Joins: staggered, but all land within the first couple of seconds —
  // simulates a room simultaneously scanning the projected QR code.
  await Promise.all(
    tokens.map(async (token) => {
      await sleep(randomInt(0, 1500));
      await postJson(`${args.baseUrl}/api/join`, { code: args.code, token });
    }),
  );
  console.log(`${tokens.length} participants joined.`);

  if (question.type === "QNA") {
    const askers = tokens.slice(0, Math.min(5, tokens.length));
    await Promise.all(
      askers.map(async (token, i) => {
        await sleep(randomInt(0, args.spreadMs));
        await postJson(`${args.baseUrl}/api/qna`, {
          code: args.code,
          token,
          text: SENTENCE_BANK[i % SENTENCE_BANK.length],
        });
      }),
    );
    console.log(`${askers.length} Q&A submissions posted.`);
  } else {
    // Responses: staggered across --spread-ms to produce a realistic
    // velocity curve instead of every answer landing in the same instant
    // (see lib/insight/velocity.ts — that instant-arrival case is exactly
    // what its noise floor exists to guard against).
    let failures = 0;
    await Promise.all(
      tokens.map(async (token) => {
        await sleep(randomInt(0, args.spreadMs));

        const body: Record<string, unknown> = { code: args.code, token, questionId: question.id };
        if (question.type === "MULTIPLE_CHOICE") {
          body.optionId = pickMultipleChoiceOptionId(question.options, args.distribution);
        } else if (question.type === "SCALE") {
          const config = question.config as { min?: number; max?: number };
          body.valueNumber = pickScaleValue(config.min ?? 1, config.max ?? 5, args.distribution);
        } else if (question.type === "WORD_CLOUD") {
          body.valueText = pickText(WORD_BANK, args.distribution);
        } else if (question.type === "OPEN_TEXT") {
          body.valueText = pickText(SENTENCE_BANK, args.distribution);
        }

        const res = await postJson(`${args.baseUrl}/api/respond`, body);
        if (!res.ok) failures++;
      }),
    );
    console.log(`${tokens.length - failures} of ${tokens.length} responses submitted. Watch the Stage.`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
