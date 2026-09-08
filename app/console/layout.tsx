import Link from "next/link";
import { readSessionFromCookie } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects unauthenticated requests away from /console/*,
  // so this is just reading the session for display, not re-authorizing.
  const session = await readSessionFromCookie();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <Link href="/console" className="flex items-center gap-2 text-base font-semibold text-brand-700">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />
          Roomtone
        </Link>
        <div className="flex items-center gap-4">
          {session && <span className="text-sm text-foreground/60">{session.name}</span>}
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col bg-background">{children}</main>
    </div>
  );
}
