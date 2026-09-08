import { notFound } from "next/navigation";
import { getSessionForParticipant } from "@/lib/sessions/queries";
import { ParticipantRoom } from "@/components/participant/participant-room";
import type { StageQuestion } from "@/components/stage/stage";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSessionForParticipant(code);
  if (!session) notFound();

  const questions: StageQuestion[] = session.deck.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
    config: q.config as StageQuestion["config"],
    pairedWithId: q.pairedWithId,
  }));

  return (
    <ParticipantRoom
      code={session.code}
      deckTitle={session.deck.title}
      questions={questions}
      initialState={session.state}
      initialActiveQuestionId={session.activeQuestionId}
    />
  );
}
