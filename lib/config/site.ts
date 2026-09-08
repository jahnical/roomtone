/**
 * Base URL used to build the participant join link embedded in the QR code
 * and shown as a fallback for typing in manually. Set PUBLIC_BASE_URL to
 * your real domain in production (see .env.example); defaults to localhost
 * for dev.
 */
export function getPublicBaseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

export function buildJoinUrl(code: string): string {
  return `${getPublicBaseUrl()}/j/${code}`;
}
