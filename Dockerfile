# syntax=docker/dockerfile:1

# Four stages: install deps once, build once, then two different runtime
# targets from the same builder — a lean `runner` (the traced `standalone`
# output, next.config.ts) that serves requests, and the full `builder`
# stage reused directly (via compose's `target: builder`) as a one-off
# migration runner. Running migrations from `builder` rather than
# hand-picking a Prisma-CLI-sized subset of node_modules into `runner`
# avoids a real failure mode: the Prisma CLI's own dependency tree
# (packages like `effect`, pulled in by @prisma/config) doesn't line up
# with what `next build`'s trace decides the *app* needs at runtime, so a
# hand-picked copy silently missed transitive deps and crashed on boot.
# `builder` already has the complete node_modules `npm ci` installed, so
# it can't have that problem.

FROM node:24-alpine AS base
# Prisma's query engine binary needs OpenSSL on Alpine (musl doesn't ship
# glibc's libssl); harmless if a given engine variant doesn't need it.
RUN apk add --no-cache openssl

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: package.json's postinstall runs `prisma generate`,
# which needs prisma/schema.prisma — not copied into this stage since it
# only exists to produce a node_modules layer cached on package.json/
# package-lock.json alone. The builder stage below runs `prisma generate`
# explicitly once the full source is present.
RUN npm ci --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --config prisma7.config.ts
RUN npm run build
# This stage is also the migration image (see compose.prod.yaml's `migrate`
# service, which sets `target: builder` and overrides the command) — no
# further build steps needed for that use, just the full node_modules,
# prisma/, and prisma7.config.ts already present here.

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
