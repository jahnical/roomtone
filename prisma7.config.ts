// Prisma 7 config for the Prisma CLI (migrate, studio, generate). This is
// distinct from the runtime connection in lib/db/client.ts — the CLI reads
// DATABASE_URL from here, while the app's PrismaClient connects through an
// explicit driver adapter. See prisma/schema.prisma for why the datasource
// block no longer carries a url.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
