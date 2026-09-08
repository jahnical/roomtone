import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getSessionForStage } from "@/lib/sessions/queries";
import { computeQuestionAggregate } from "@/lib/realtime/aggregate";
import { buildJoinUrl } from "@/lib/config/site";
import { isAiEnabled } from "@/lib/ai/provider";
import { Stage, type StageQuestion } from "@/components/stage/stage";

// Deliberately outside /console: the Stage is a full-screen projected view
// with its own chrome (see components/stage/stage.tsx), not an admin page —
// it must not inherit the console layout's header/sign-out bar. Still
// protected: proxy.ts's matcher covers /present/:path* too, and this page
// re-verifies ownership itself via getSessionForStage regardless.
export default async function StagePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const auth = await requireSession();
  const session = await getSessionForStage(sessionId, auth.userId);
  if (!session) notFound();
  if (session.state === "DRAFT") {
    redirect(`/console/sessions/${sessionId}`);
  }

  const aggregateEntries = await Promise.all(
    session.deck.questions.map(async (q) => [q.id, await computeQuestionAggregate(session.id, q.id)] as const),
  );
  const initialAggregates = Object.fromEntries(
    aggregateEntries.filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== null),
  );

  const questions: StageQuestion[] = session.deck.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
    config: q.config as StageQuestion["config"],
    pairedWithId: q.pairedWithId,
  }));

  return (
    <Stage
      sessionId={session.id}
      code={session.code}
      deckTitle={session.deck.title}
      joinUrl={buildJoinUrl(session.code)}
      aiEnabled={isAiEnabled()}
      questions={questions}
      initialState={session.state}
      initialActiveQuestionId={session.activeQuestionId}
      initialParticipantCount={session._count.participants}
      initialAggregates={initialAggregates}
    />
  );
}
