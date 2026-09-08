import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 requires an explicit driver adapter at runtime — see
// prisma/schema.prisma and prisma7.config.ts for the split between this
// (app runtime) and the CLI's own connection config.
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Standard Next.js dev-mode singleton: without this, every hot reload would
// open a fresh Prisma connection pool against Postgres until it runs out.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// A Proxy, not a plain `createClient()` call, so that *importing* this
// module never requires DATABASE_URL to be set — only actually querying
// does. `next build`'s page-data-collection step imports every route
// module (including ones that merely re-export a config object) to
// inspect it, without ever calling a Prisma method; a real client
// constructed at module scope would throw during that step even for
// routes that never got invoked. Every property access below transparently
// forwards to the real (lazily-created, cached) client.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
