"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionState } from "@prisma/client";
import { advanceQuestion, endSession } from "@/lib/sessions/actions";
import type { QnaItemPayload, QuestionAggregate, RealtimeEvent } from "@/lib/realtime/events";
import type { QuestionTypeValue } from "@/lib/validation/deck";
import { computeLiveInsight } from "@/lib/insight/live";
import { computeVelocity } from "@/lib/insight/velocity";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { BASE_PATH } from "@/lib/config/base-path";
import { WordCloudView } from "./word-cloud-view";
import { StageBarChart, type BarDatum } from "./stage-bar-chart";
import { ResponseWall } from "./response-wall";
import { InsightDrawer } from "./insight-drawer";
import { QnaStageBoard } from "./qna-stage-board";
import { MovementPanel } from "./movement-panel";
import { Button } from "@/components/ui/button";

export interface StageQuestion {
  id: string;
  prompt: string;
  type: QuestionTypeValue;
  options: { id: string; label: string }[];
  config: { min?: number; max?: number; minLabel?: string; maxLabel?: string };
  pairedWithId: string | null;
}

interface StageProps {
  sessionId: string;
  code: string;
  deckTitle: string;
  // Computed server-side (see app/present/[sessionId]/page.tsx) rather than
  // via buildJoinUrl() in this Client Component: PUBLIC_BASE_URL isn't
  // NEXT_PUBLIC_-prefixed, so it wouldn't be inlined into the browser
  // bundle — calling it here would silently fall back to localhost in any
  // real deployment.
  joinUrl: string;
  // Same reasoning as joinUrl: AI_PROVIDER is server-only config, resolved
  // once in the server page (see lib/ai/provider.ts's isAiEnabled) rather
  // than re-checked here, since this Client Component has no business
  // reading provider secrets even indirectly.
  aiEnabled: boolean;
  questions: StageQuestion[];
  initialState: SessionState;
  initialActiveQuestionId: string | null;
  initialParticipantCount: number;
  initialAggregates: Record<string, QuestionAggregate>;
}

function aggregateTotal(aggregate: QuestionAggregate | undefined): number {
  if (!aggregate) return 0;
  return "total" in aggregate ? aggregate.total : 0;
}

export function Stage({
  sessionId,
  code,
  deckTitle,
  joinUrl,
  aiEnabled,
  questions,
  initialState,
  initialActiveQuestionId,
  initialParticipantCount,
  initialAggregates,
}: StageProps) {
  const [sessionState, setSessionState] = useState(initialState);
  const [activeQuestionId, setActiveQuestionId] = useState(initialActiveQuestionId);
  const [participantCount, setParticipantCount] = useState(initialParticipantCount);
  const [aggregates, setAggregates] = useState(initialAggregates);
  const [qrHidden, setQrHidden] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [qnaItems, setQnaItems] = useState<QnaItemPayload[]>([]);
  const confirm = useConfirm();

  // Realtime updates from every connected participant (and this Stage's own
  // reconnects) — see app/api/live/[code]/route.ts.
  useEffect(() => {
    const source = new EventSource(`${BASE_PATH}/api/live/${code}`);
    source.onmessage = (ev) => {
      const event = JSON.parse(ev.data) as RealtimeEvent;
      if (event.type === "question-update") {
        setAggregates((prev) => ({ ...prev, [event.questionId]: event.aggregate }));
      } else if (event.type === "participant-count") {
        setParticipantCount(event.count);
      } else if (event.type === "session-state") {
        setSessionState(event.state);
        setActiveQuestionId(event.activeQuestionId);
      } else if (event.type === "qna-update") {
        setQnaItems(event.items);
      }
    };
    return () => source.close();
  }, [code]);

  // Keyboard controls: ←/→ navigate, F fullscreen, H hide/show the QR panel.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key === "ArrowRight") {
        advanceQuestion(sessionId, "next").catch(() => {});
      } else if (e.key === "ArrowLeft") {
        advanceQuestion(sessionId, "prev").catch(() => {});
      } else if (e.key.toLowerCase() === "f") {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.();
        }
      } else if (e.key.toLowerCase() === "h") {
        setQrHidden((v) => !v);
      } else if (e.key.toLowerCase() === "i") {
        setInsightOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sessionId]);

  const activeIndex = questions.findIndex((q) => q.id === activeQuestionId);
  const activeQuestion = activeIndex >= 0 ? questions[activeIndex] : null;
  const activeAggregate = activeQuestion ? aggregates[activeQuestion.id] : undefined;

  // How fast this session's *other* questions converged, for velocity's
  // "slower/faster than usual" comparison — every other question's own
  // time-to-50%, recomputed from data already in `aggregates`.
  const baselineMsToHalf = useMemo(() => {
    return Object.entries(aggregates)
      .filter(([questionId]) => questionId !== activeQuestionId)
      .map(([, aggregate]) => ("respondedAt" in aggregate ? computeVelocity(aggregate.respondedAt.map((t) => new Date(t).getTime())).msToHalf : null))
      .filter((v): v is number => v != null && v > 0);
  }, [aggregates, activeQuestionId]);

  const liveInsight = useMemo(() => {
    if (!activeQuestion) return null;
    return computeLiveInsight(activeQuestion, activeAggregate, participantCount, baselineMsToHalf);
  }, [activeQuestion, activeAggregate, participantCount, baselineMsToHalf]);

  // The QR panel starts prominent (nobody's answered yet, so there's
  // nothing else to show) and shrinks to a corner badge once the room
  // starts actively answering the current question — a simpler, fully
  // client-visible proxy for "once joins plateau" that doesn't need
  // time-series tracking of join velocity.
  const hasResponses = aggregateTotal(activeAggregate) > 0;
  const qrProminent = !qrHidden && !hasResponses;

  return (
    <div className="stage flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-stage-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-stage-foreground-muted">{deckTitle}</span>
          {sessionState === "LIVE" && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-stage-cyan">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stage-cyan" aria-hidden />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-stage-foreground-muted">
          <span>{participantCount} joined</span>
          <span>
            Question {activeIndex >= 0 ? activeIndex + 1 : "–"} / {questions.length}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setInsightOpen((v) => !v)}>
            Insight
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              confirm({
                title: "End this session?",
                message: "Participants will no longer be able to respond. You can still view the report afterward.",
                confirmLabel: "End session",
                destructive: true,
              }).then((ok) => {
                if (ok) endSession(sessionId).catch(() => {});
              });
            }}
          >
            End session
          </Button>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center gap-4 overflow-hidden px-10 py-8">
        {activeQuestion ? (
          <>
            <h1 className="max-w-4xl text-center text-3xl font-semibold text-stage-foreground sm:text-4xl">
              {activeQuestion.prompt}
            </h1>

            {liveInsight && (
              <div className="flex flex-col items-center gap-2">
                <p className="max-w-2xl text-center text-sm text-stage-foreground-muted">{liveInsight.narration}</p>
                {liveInsight.chips.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {liveInsight.chips.map((chip) => (
                      <span
                        key={chip.label}
                        className="rounded-full border border-stage-border bg-stage-bg-raised px-3 py-1 text-xs text-stage-foreground-muted"
                      >
                        {chip.label}: <span className="font-medium text-stage-foreground">{chip.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeQuestion.pairedWithId && (
              <MovementPanel
                sessionId={sessionId}
                questionId={activeQuestion.id}
                refreshKey={aggregateTotal(activeAggregate)}
              />
            )}

            <div className="w-full max-w-5xl flex-1">
              <QuestionVisualization
                question={activeQuestion}
                aggregate={activeAggregate}
                sessionId={sessionId}
                qnaItems={qnaItems}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xl text-stage-foreground-muted">
            {questions.length === 0 ? "This deck has no questions." : "Session ended."}
          </div>
        )}

        <QrPanel code={code} joinUrl={joinUrl} prominent={qrProminent} hidden={qrHidden} />

        {insightOpen && activeQuestion && liveInsight && (
          <InsightDrawer
            questionType={activeQuestion.type}
            insight={liveInsight}
            sessionId={sessionId}
            questionId={activeQuestion.id}
            aiEnabled={aiEnabled}
          />
        )}
      </main>

      <nav className="flex items-center justify-center gap-3 border-t border-stage-border px-6 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={activeIndex <= 0}
          onClick={() => advanceQuestion(sessionId, "prev").catch(() => {})}
        >
          ← Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={activeIndex < 0 || activeIndex >= questions.length - 1}
          onClick={() => advanceQuestion(sessionId, "next").catch(() => {})}
        >
          Next →
        </Button>
      </nav>
    </div>
  );
}

function QuestionVisualization({
  question,
  aggregate,
  sessionId,
  qnaItems,
}: {
  question: StageQuestion;
  aggregate: QuestionAggregate | undefined;
  sessionId: string;
  qnaItems: QnaItemPayload[];
}) {
  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      const byOption = new Map(
        aggregate?.type === "MULTIPLE_CHOICE" ? aggregate.options.map((o) => [o.optionId, o.count]) : [],
      );
      const data: BarDatum[] = question.options.map((o) => ({ label: o.label, count: byOption.get(o.id) ?? 0 }));
      return <StageBarChart data={data} mode="dark" />;
    }

    case "WORD_CLOUD": {
      const words = aggregate?.type === "WORD_CLOUD" ? aggregate.words : [];
      return <WordCloudView words={words} mode="dark" />;
    }

    case "OPEN_TEXT": {
      const responses = aggregate?.type === "OPEN_TEXT" ? aggregate.responses : [];
      return <ResponseWall responses={responses} />;
    }

    case "SCALE": {
      const min = question.config.min ?? 1;
      const max = question.config.max ?? 5;
      const counts = aggregate?.type === "SCALE" ? aggregate.counts : null;
      const data: BarDatum[] =
        counts?.map((c) => ({ label: String(c.value), count: c.count })) ??
        Array.from({ length: max - min + 1 }, (_, i) => ({ label: String(min + i), count: 0 }));
      const mean = aggregate?.type === "SCALE" ? aggregate.mean : null;
      return (
        <div className="flex h-full flex-col items-center gap-2">
          {question.config.minLabel || question.config.maxLabel ? (
            <div className="flex w-full max-w-2xl justify-between text-sm text-stage-foreground-muted">
              <span>{question.config.minLabel}</span>
              <span>{question.config.maxLabel}</span>
            </div>
          ) : null}
          {mean != null && (
            <div className="text-lg text-stage-foreground-muted">
              Average: <span className="font-semibold text-stage-foreground">{mean.toFixed(1)}</span>
            </div>
          )}
          <div className="w-full flex-1">
            <StageBarChart data={data} mode="dark" />
          </div>
        </div>
      );
    }

    case "QNA":
      return <QnaStageBoard sessionId={sessionId} items={qnaItems} />;
  }
}

function QrPanel({
  code,
  joinUrl,
  prominent,
  hidden,
}: {
  code: string;
  joinUrl: string;
  prominent: boolean;
  hidden: boolean;
}) {
  if (hidden) return null;

  return (
    <div
      className={
        prominent
          ? "flex flex-col items-center gap-3 rounded-2xl border border-stage-border bg-stage-bg-raised p-6"
          : "absolute bottom-4 right-4 flex items-center gap-3 rounded-xl border border-stage-border bg-stage-bg-raised p-3"
      }
    >
      <div className={prominent ? "rounded-xl bg-white p-3" : "rounded-lg bg-white p-1.5"}>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG generated per-request by our own API route */}
        <img
          src={`${BASE_PATH}/api/qr/${code}`}
          alt={`QR code to join at ${joinUrl}`}
          width={prominent ? 220 : 84}
          height={prominent ? 220 : 84}
          className="block"
        />
      </div>
      <div className={prominent ? "flex flex-col items-center gap-1" : "flex flex-col"}>
        <span className={prominent ? "font-mono text-3xl tracking-[0.3em] text-stage-foreground" : "font-mono text-sm tracking-widest text-stage-foreground"}>
          {code}
        </span>
        {prominent && <span className="text-sm text-stage-foreground-muted">{joinUrl}</span>}
      </div>
    </div>
  );
}
