"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "@prisma/client";
import type { QnaItemPayload, RealtimeEvent } from "@/lib/realtime/events";
import { getOrCreateParticipantToken } from "@/lib/client/participant-token";
import type { StageQuestion } from "@/components/stage/stage";
import { useToast } from "@/components/ui/toast";
import { AnswerForm } from "./answer-form";

interface ParticipantRoomProps {
  code: string;
  deckTitle: string;
  questions: StageQuestion[];
  initialState: SessionState;
  initialActiveQuestionId: string | null;
}

/**
 * The presenter decides which single question is open for responses, and
 * when (see setActiveQuestion in lib/sessions/actions.ts) — a deck can hold
 * several questions the presenter opens one at a time, in any order, over
 * however long they want, including well before ever clicking Start
 * presenting. This component just follows whatever's currently open over
 * SSE; it never gets ahead of the presenter on its own.
 */
export function ParticipantRoom({ code, deckTitle, questions, initialState, initialActiveQuestionId }: ParticipantRoomProps) {
  const toast = useToast();
  const [sessionState, setSessionState] = useState(initialState);
  const [activeQuestionId, setActiveQuestionId] = useState(initialActiveQuestionId);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmittedFor, setJustSubmittedFor] = useState<string | null>(null);
  const [qnaItems, setQnaItems] = useState<QnaItemPayload[]>([]);
  // useState's lazy initializer runs exactly once, on the client's first
  // render, which is what makes this SSR-safe: getOrCreateParticipantToken
  // touches window.localStorage, which doesn't exist during this Client
  // Component's server-side render pass ('use client' still means it's
  // SSR'd once for the initial HTML, then hydrated, it isn't client-only
  // rendering). Unlike a ref, this can be read directly in JSX below.
  const [token] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getOrCreateParticipantToken(code),
  );

  // Register presence as soon as we land here, even before the presenter
  // has opened a question, so the "N joined" count reflects the waiting room.
  useEffect(() => {
    if (!token) return;
    fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, token }),
    }).catch(() => {});
  }, [code, token]);

  useEffect(() => {
    const source = new EventSource(`/api/live/${code}`);
    source.onmessage = (ev) => {
      const event = JSON.parse(ev.data) as RealtimeEvent;
      if (event.type === "session-state") {
        setSessionState(event.state);
        setActiveQuestionId((prev) => {
          if (event.activeQuestionId !== prev) setJustSubmittedFor(null);
          return event.activeQuestionId;
        });
      } else if (event.type === "qna-update") {
        setQnaItems(event.items);
      }
    };
    return () => source.close();
  }, [code]);

  const activeQuestion = questions.find((q) => q.id === activeQuestionId) ?? null;

  async function handleSubmit(questionId: string, value: { optionId?: string; valueText?: string; valueNumber?: number }) {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token, questionId, ...value }),
      });
      if (res.ok) {
        setJustSubmittedFor(questionId);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.show(body.error ?? "Couldn't submit your answer. Try again.", "error");
      }
    } catch {
      toast.show("Couldn't reach Roomtone. Check your connection and try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="responder flex min-h-full flex-1 flex-col px-5 py-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{deckTitle}</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6">
        {sessionState === "ENDED" ? (
          <div className="text-center">
            <p className="text-lg font-medium text-brand-950">Thanks for participating!</p>
            <p className="mt-1 text-sm text-brand-950/60">This session has ended.</p>
          </div>
        ) : questions.length === 0 ? (
          <p className="text-lg text-brand-950/60">This deck has no questions yet.</p>
        ) : activeQuestion ? (
          <div className="flex w-full max-w-sm flex-col gap-6 rounded-3xl border border-brand-100 bg-white p-6 shadow-lg shadow-brand-950/5">
            <h1 className="text-center text-2xl font-semibold text-brand-950">{activeQuestion.prompt}</h1>
            {/* QNA is a running board, not a single answer-then-done — it never shows the checkmark confirmation. */}
            {activeQuestion.type !== "QNA" && justSubmittedFor === activeQuestion.id ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-600">
                  ✓
                </span>
                <p className="text-brand-950/60">Got it, thanks!</p>
                <button
                  type="button"
                  onClick={() => setJustSubmittedFor(null)}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  Change my answer
                </button>
              </div>
            ) : (
              <AnswerForm
                key={activeQuestion.id}
                question={activeQuestion}
                submitting={submitting}
                onSubmit={(value) => handleSubmit(activeQuestion.id, value)}
                code={code}
                token={token}
                qnaItems={qnaItems}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="h-3 w-3 animate-ping rounded-full bg-brand-400" aria-hidden />
            <p className="text-lg text-brand-950/70">Waiting for the next question…</p>
          </div>
        )}
      </main>
    </div>
  );
}
