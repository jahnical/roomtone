import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getDecksForUser } from "@/lib/decks/queries";
import { NewDeckForm } from "@/components/decks/new-deck-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Your decks · Roomtone" };

export default async function ConsoleHomePage() {
  const session = await requireSession();
  const decks = await getDecksForUser(session.userId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your decks</h1>
          <p className="text-foreground/60">Build a set of questions, then present it to a room.</p>
        </div>
      </div>

      <NewDeckForm />

      {decks.length === 0 ? (
        <p className="text-sm text-foreground/50">No decks yet, create your first one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/console/decks/${deck.id}`}>
              <Card className="h-full transition-colors hover:border-brand-300">
                <CardHeader>
                  <CardTitle>{deck.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-foreground/60">
                  <span>
                    {deck._count.questions} question{deck._count.questions === 1 ? "" : "s"}
                  </span>
                  <span>
                    {deck._count.sessions} session{deck._count.sessions === 1 ? "" : "s"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
