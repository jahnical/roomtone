/**
 * Single source of truth for Next's basePath (see next.config.ts), because
 * basePath must be a build-time literal, not a runtime env var: it's inlined
 * into the client bundle, and Docker's build stage doesn't share environment
 * with the compose file that later runs the image. next/link, useRouter,
 * and next/image get this prefix automatically; anything built by hand
 * (fetch, EventSource, a raw <img>/<a> src/href) doesn't and needs BASE_PATH
 * prepended explicitly. Changing this requires a rebuild, not just a
 * redeploy, per Next's own basePath docs.
 */
export const BASE_PATH = "/roomtone";
