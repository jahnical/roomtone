import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getSessionForUser } from "@/lib/sessions/queries";
import { buildJoinUrl } from "@/lib/config/site";
import { DeleteSessionButton } from "@/components/decks/delete-session-button";
import { StartSessionButton } from "@/components/decks/start-session-button";
import { QuestionPicker } from "@/components/decks/question-picker";

export default async function SessionLobbyPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const auth = await requireSession();
  const roomtoneSession = await getSessionForUser(sessionId, auth.userId);
  if (!roomtoneSession) notFound();

  const joinUrl = buildJoinUrl(roomtoneSession.code);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-6 py-10 text-center">
      <div>
        <Link href={`/console/decks/${roomtoneSession.deckId}`} className="text-sm text-brand-600 hover:underline">
          ← {roomtoneSession.deck.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Session lobby</h1>
        <p className="text-foreground/60">Project this screen, or share the code below.</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="rounded-xl bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG generated per-request by our own API route, not an optimizable static asset */}
          <img
            src={`/api/qr/${roomtoneSession.code}`}
            alt={`QR code to join session ${roomtoneSession.code}`}
            width={280}
            height={280}
            className="block"
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-4xl font-semibold tracking-[0.3em] text-brand-700">
          {roomtoneSession.code}
        </span>
        <a href={joinUrl} target="_blank" rel="noreferrer" className="text-sm text-foreground/50 hover:underline">
          {joinUrl}
        </a>
      </div>

      <div className="flex items-center gap-4 text-sm text-foreground/60">
        <span>{roomtoneSession._count.participants} joined</span>
        <span>{roomtoneSession.deck.questions.length} question{roomtoneSession.deck.questions.length === 1 ? "" : "s"}</span>
        <span>{roomtoneSession.state}</span>
      </div>

      {roomtoneSession.state === "ENDED" ? (
        <p className="text-sm text-foreground/50">This session has ended.</p>
      ) : (
        <>
          <StartSessionButton
            sessionId={roomtoneSession.id}
            label={roomtoneSession.state === "LIVE" ? "Resume presenting" : "Start presenting"}
          />
          <QuestionPicker
            sessionId={roomtoneSession.id}
            questions={roomtoneSession.deck.questions}
            initialActiveQuestionId={roomtoneSession.activeQuestionId}
          />
        </>
      )}

      {roomtoneSession.state !== "DRAFT" && (
        <Link href={`/console/sessions/${roomtoneSession.id}/report`} className="text-sm text-brand-600 hover:underline">
          View report
        </Link>
      )}

      <DeleteSessionButton sessionId={roomtoneSession.id} />
    </div>
  );
}
