import path from "node:path";
import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/config/base-path";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project: without it, Next.js walks up
  // looking for a lockfile and finds an unrelated one in ~/Projects, which
  // sits outside this git repo and isn't actually part of this app.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Traces the minimal file set (only the node_modules each page actually
  // needs) into .next/standalone, so the production Docker image doesn't
  // have to ship the full node_modules tree — see Dockerfile.
  output: "standalone",
  // This deployment lives at /roomtone behind a shared reverse proxy rather
  // than owning its own domain/subdomain. next/link, useRouter, and
  // next/image pick this up automatically; anything built by hand (fetch,
  // EventSource, a raw img/a src/href) uses BASE_PATH explicitly instead —
  // see lib/config/base-path.ts.
  basePath: BASE_PATH,
};

export default nextConfig;
