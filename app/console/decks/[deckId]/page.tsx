import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDeckWithQuestions } from "@/lib/decks/queries";
import { DeckDetailsEditor } from "@/components/decks/deck-details-editor";
import { DeleteDeckButton } from "@/components/decks/delete-deck-button";
import { QuestionRow } from "@/components/decks/question-row";
import { AddQuestionPanel } from "@/components/decks/add-question-panel";
import { CreateSessionButton } from "@/components/decks/create-session-button";
import type { QuestionFormInitialValues } from "@/components/decks/question-form";

export default async function DeckEditorPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const session = await requireSession();
  const deck = await getDeckWithQuestions(deckId, session.userId);
  if (!deck) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-4">
        <DeckDetailsEditor deckId={deck.id} title={deck.title} description={deck.description} />
        <div className="flex items-center gap-3">
          <CreateSessionButton deckId={deck.id} />
          <DeleteDeckButton deckId={deck.id} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Questions</h2>
        {deck.questions.length === 0 ? (
          <p className="text-sm text-foreground/50">No questions yet, add one below.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deck.questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                index={i}
                question={{
                  id: q.id,
                  prompt: q.prompt,
                  type: q.type,
                  pairedWithId: q.pairedWithId,
                  options: q.options,
                  config: q.config as QuestionFormInitialValues["config"],
                  isFirst: i === 0,
                  isLast: i === deck.questions.length - 1,
                }}
                earlierQuestions={deck.questions.slice(0, i).map((eq) => ({ id: eq.id, prompt: eq.prompt }))}
              />
            ))}
          </div>
        )}
        <AddQuestionPanel
          deckId={deck.id}
          earlierQuestions={deck.questions.map((q) => ({ id: q.id, prompt: q.prompt }))}
        />
      </section>

      {deck.sessions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Recent sessions</h2>
          <div className="flex flex-col gap-2">
            {deck.sessions.map((s) => (
              <Link
                key={s.id}
                href={`/console/sessions/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-sm hover:border-brand-300"
              >
                <span className="font-mono tracking-widest text-brand-700">{s.code}</span>
                <span className="text-foreground/50">{s.state}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
