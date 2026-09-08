import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getSessionReportData, type SessionReportQuestion } from "@/lib/reports/data";
import { QUESTION_TYPE_LABELS } from "@/lib/validation/deck";
import { StageBarChart, type BarDatum } from "@/components/stage/stage-bar-chart";
import { WordCloudView } from "@/components/stage/word-cloud-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { BASE_PATH } from "@/lib/config/base-path";

export const metadata = { title: "Session report · Roomtone" };

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const auth = await requireSession();
  const data = await getSessionReportData(sessionId, auth.userId);
  if (!data) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/console/decks/${data.deckId}`} className="text-sm text-brand-600 hover:underline">
            ← {data.deckTitle}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Session report</h1>
          <p className="text-sm text-foreground/60">
            Code <span className="font-mono">{data.code}</span> · {data.participantCount} joined · {data.state}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={`${BASE_PATH}/api/export/${data.sessionId}/csv`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Export CSV
          </a>
          <a
            href={`${BASE_PATH}/api/export/${data.sessionId}/markdown`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Export Markdown
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {data.questions.map((q) => (
          <QuestionReportCard key={q.id} question={q} allQuestions={data.questions} />
        ))}
      </div>

      {data.qnaItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Q&amp;A ({data.qnaItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.qnaItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className={item.answered ? "text-foreground/50 line-through" : "text-foreground"}>
                  {item.text}
                </span>
                <span className="shrink-0 text-foreground/50">{item.upvotes} upvotes</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuestionReportCard({
  question,
  allQuestions,
}: {
  question: SessionReportQuestion;
  allQuestions: SessionReportQuestion[];
}) {
  const pairedFrom = question.pairedWithId ? allQuestions.find((q) => q.id === question.pairedWithId) : null;

  return (
    <Card>
      <CardHeader>
        <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
          Q{question.order + 1} · {QUESTION_TYPE_LABELS[question.type]}
        </span>
        <CardTitle>{question.prompt}</CardTitle>
        <p className="text-sm text-foreground/60">{question.insight.narration}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {question.insight.chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {question.insight.chips.map((chip) => (
              <span
                key={chip.label}
                className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-foreground/70"
              >
                {chip.label}: <span className="font-medium text-foreground">{chip.value}</span>
              </span>
            ))}
          </div>
        )}

        <QuestionReportVisual question={question} />

        {question.pairing && question.pairing.kind !== "unavailable" && question.pairing.shift.n > 0 && (
          <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Movement from &ldquo;{pairedFrom?.prompt ?? question.pairing.beforePrompt}&rdquo; (
              {question.pairing.shift.n} answered both)
            </p>
            {question.pairing.kind === "MULTIPLE_CHOICE" ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-foreground/80">
                {question.pairing.shift.transitions
                  .filter((t) => t.from !== t.to)
                  .map((t, i) => (
                    <li key={i}>
                      {t.count} moved {t.from} → {t.to}
                    </li>
                  ))}
                <li className="text-foreground/50">{question.pairing.shift.stayedSameCount} stayed the same</li>
              </ul>
            ) : (
              <p className="text-foreground/80">
                Average moved from {question.pairing.shift.meanBefore?.toFixed(1)} to{" "}
                {question.pairing.shift.meanAfter?.toFixed(1)}
                {question.pairing.shift.meanDelta != null && (
                  <span className="text-foreground/50">
                    {" "}
                    ({question.pairing.shift.meanDelta >= 0 ? "+" : ""}
                    {question.pairing.shift.meanDelta.toFixed(1)})
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {question.insight.outliers && question.insight.outliers.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Worth reading aloud
            </p>
            <ul className="flex flex-col gap-1">
              {question.insight.outliers.map((o, i) => (
                <li key={i} className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground/80">
                  “{o.text}”
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionReportVisual({ question }: { question: SessionReportQuestion }) {
  const aggregate = question.aggregate;

  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      const byOption = new Map(
        aggregate?.type === "MULTIPLE_CHOICE" ? aggregate.options.map((o) => [o.optionId, o.count]) : [],
      );
      const data: BarDatum[] = question.options.map((o) => ({ label: o.label, count: byOption.get(o.id) ?? 0 }));
      return (
        <div className="h-56 w-full">
          <StageBarChart data={data} mode="light" />
        </div>
      );
    }

    case "SCALE": {
      const min = question.config.min ?? 1;
      const max = question.config.max ?? 5;
      const counts = aggregate?.type === "SCALE" ? aggregate.counts : null;
      const data: BarDatum[] =
        counts?.map((c) => ({ label: String(c.value), count: c.count })) ??
        Array.from({ length: max - min + 1 }, (_, i) => ({ label: String(min + i), count: 0 }));
      return (
        <div className="h-56 w-full">
          <StageBarChart data={data} mode="light" />
        </div>
      );
    }

    case "WORD_CLOUD": {
      const words = aggregate?.type === "WORD_CLOUD" ? aggregate.words : [];
      return (
        <div className="h-56 w-full">
          <WordCloudView words={words} mode="light" />
        </div>
      );
    }

    case "OPEN_TEXT": {
      if (!question.insight.clusters || question.insight.clusters.length === 0) {
        return <p className="text-sm text-foreground/40">No responses.</p>;
      }
      return (
        <ul className="flex flex-col gap-1.5">
          {question.insight.clusters.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm">
              <span className="text-foreground/80">{c.exemplar}</span>
              <span className="shrink-0 text-foreground/50">{c.count}</span>
            </li>
          ))}
        </ul>
      );
    }

    case "QNA":
      return <p className="text-sm text-foreground/40">See the Q&amp;A section below.</p>;
  }
}
