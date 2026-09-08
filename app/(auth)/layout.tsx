import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-brand-50 to-background px-4 py-16 dark:from-stage-bg dark:to-background">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold text-brand-700 dark:text-brand-300">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />
          Roomtone
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
