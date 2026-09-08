# Roomtone

Roomtone is a live audience-response tool: project a question, your audience scans a QR code and answers on their phone, and results appear on the projector in real time as word clouds, bar charts, or an open-text wall.

The part that makes it more than a Mentimeter clone is the insight layer. Instead of just showing what the room answered, Roomtone tells you what that means: whether the room is genuinely split or just noisy, whether a slow response time suggests the question confused people, which minority answer is worth reading aloud, and how opinions shifted between a "before" and "after" version of the same question. All of that is computed statistically, with an optional AI layer (via Ollama or OpenRouter) for labeling themes in open-text clusters and spotting likely misconceptions.

Named after the film-sound term: the ambient tone of an empty room, recorded so editors can hear what the space actually sounds like. That's the product, for the room you're presenting to.

## Features

- **Five question types**: multiple choice, word cloud, open text, a 1–5 style scale, and a live Q&A wall with upvoting.
- **Pre/post pairing**: pair a "before" question with an "after" one and see exactly how (and how many) people changed their answer.
- **Real-time results** over Server-Sent Events, no manual refresh, on both the presenter's projector view and every participant's phone.
- **Statistical insight engine**, no AI required: response-rate and silent-joiner tracking, Shannon-entropy divergence, Sarle's bimodality coefficient for scale questions, TF-IDF text clustering with outlier detection for open text, and answer-velocity comparisons against a session's own baseline.
- **Optional AI layer** (Ollama or OpenRouter, your choice, never a hosted key you don't control): theme labeling for text clusters and misconception suggestions. Every AI affordance disappears cleanly if you don't configure a provider.
- **Presenter-controlled pacing**: open exactly one question for responses at a time, whenever you want, independent of whether you're actively projecting. Participants' screens follow along automatically.
- **Anonymous participation**: a participant gets a random opaque token, never a name, so pre/post pairing can show *that* people changed their minds without anyone knowing *who*.
- **Full accounts** for presenters (email + password), decks are reusable across sessions, and each session gets its own 6-character join code and QR.
- **CSV and Markdown export** of session reports.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · PostgreSQL 16 via Prisma 7 · Server-Sent Events for realtime (in-memory by default, Postgres `LISTEN/NOTIFY` adapter for horizontal scaling) · `@node-rs/argon2` + `jose` for hand-rolled auth (no external auth framework) · Vitest.

## Getting started

**Prerequisites**: Node 24+, Docker (for a local Postgres instance), and optionally [Ollama](https://ollama.com) if you want the AI layer without an API key.

```bash
git clone <this-repo-url>
cd roomtone
npm install
cp .env.example .env
```

Edit `.env` — at minimum, generate a session-signing secret:

```bash
openssl rand -hex 32
```

Then start Postgres and apply the schema:

```bash
npm run db:up       # Postgres in Docker, localhost:5433
npm run db:migrate  # applies prisma/migrations
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, create a deck, and present it. Scan the QR with your phone (or open the join URL directly) to answer as a participant.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. |
| `AUTH_SECRET` | Yes | Signs the presenter session cookie. Generate with `openssl rand -hex 32`. |
| `PUBLIC_BASE_URL` | Yes | Used to build the participant join link embedded in each QR code. Must match wherever the app is actually reachable. |
| `AI_PROVIDER` | No | `none` (default) \| `ollama` \| `openrouter`. |
| `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL` | No | Only used when `AI_PROVIDER=ollama`. |
| `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL` | No | Only used when `AI_PROVIDER=openrouter`. |
| `REALTIME_ADAPTER` | No | `memory` (default, correct for a single app instance) \| `postgres` (only needed behind a load balancer with multiple app containers). |

See `.env.example` for a filled-in local template.

## Testing

```bash
npm test        # vitest — the insight engine's math, fixture-based
npm run lint
npx tsc --noEmit
```

For exercising the live loop without rounding up real people, `scripts/simulate.ts` joins simulated participants to a live session over the real HTTP API and answers whatever question is currently open, with a configurable distribution:

```bash
npm run simulate -- --code=ABC123 --count=25 --distribution=split
```

`--distribution` is `even` (default), `split` (bimodal, to see the insight engine call out a divided room), or `consensus`.

## Deploying

The included `Dockerfile` and `compose.prod.yaml` run the whole stack (app + Postgres) in containers, with migrations applied automatically on startup:

```bash
cp .env.prod.example .env
# fill in DB_PASSWORD, AUTH_SECRET, and PUBLIC_BASE_URL for real
docker compose -f compose.prod.yaml up -d --build
```

The app container publishes to `127.0.0.1:3000` only, it does not terminate TLS itself. Put a reverse proxy in front (nginx, Caddy, Nginx Proxy Manager, etc.) to handle HTTPS and route your domain to it.

## Project structure

```
app/                Routes: marketing, auth, console (deck editor), present (Stage), j/[code] (participant)
components/          UI components, split by surface: decks/, stage/, participant/, ui/
lib/
  insight/           Pure, unit-tested analytics — the statistical core
  ai/                Optional Ollama/OpenRouter layer, OpenAI-compatible
  realtime/          SSE hub, pluggable in-memory vs. Postgres LISTEN/NOTIFY adapter
  auth/, sessions/, decks/, reports/   Domain logic and server actions
prisma/              Schema and migrations
scripts/simulate.ts  Virtual-classroom load tester
```

## Known limitations

This has been used and tested, but hasn't run at real scale in the wild yet. Before relying on it for something that matters:

- No rate limiting on login, registration, or the public respond/Q&A endpoints.
- No password-reset flow, a locked-out user currently has no self-service recovery.
- No automated database backups, that's on you at the infrastructure level.

## Contributing

PRs welcome. Please run `npm test`, `npm run lint`, and `npx tsc --noEmit` before submitting, they're fast and catch most regressions.

## License

MIT, see [LICENSE](LICENSE).
