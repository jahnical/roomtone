import Link from "next/link";
import { readSessionFromCookie } from "@/lib/auth/session";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const session = await readSessionFromCookie();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-background px-6 py-24 text-center dark:from-stage-bg dark:to-background">
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-stage-border dark:bg-stage-bg-raised dark:text-brand-200">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
        Live audience response
      </span>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Read the real state of the room.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-foreground/60">
        Project a question, students scan a QR code, and answers appear live as word clouds, bar
        charts, and open text, with the insight to tell you what the room actually means.
      </p>
      <div className="mt-8 flex gap-3">
        {session ? (
          <Link href="/console" className={buttonVariants({ size: "lg" })}>
            Go to your decks
          </Link>
        ) : (
          <>
            <Link href="/register" className={buttonVariants({ size: "lg" })}>
              Get started
            </Link>
            <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
