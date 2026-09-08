"use client";

import { useEffect, useState } from "react";
import type { PairingResult } from "@/lib/insight/pairing-query";

/**
 * Shown only when the active question is paired (Question.pairedWithId) —
 * fetched on demand from /api/pairing rather than pushed over SSE, since
 * pairing needs a per-participant join across two questions' raw Response
 * rows, not just the aggregate counts the live stream already carries.
 * `refreshKey` (the after-question's current response total) is what
 * triggers a refetch as new answers come in.
 */
export function MovementPanel({
  sessionId,
  questionId,
  refreshKey,
}: {
  sessionId: string;
  questionId: string;
  refreshKey: number;
}) {
  const [result, setResult] = useState<PairingResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pairing/${sessionId}/${questionId}`)
      .then((r) => r.json())
      .then((data: PairingResult) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, questionId, refreshKey]);

  if (!result || result.kind === "unavailable" || result.shift.n === 0) return null;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-stage-border bg-stage-bg-raised px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stage-foreground-muted">
        Movement from &ldquo;{result.beforePrompt}&rdquo; ({result.shift.n} answered both)
      </p>
      {result.kind === "MULTIPLE_CHOICE" ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stage-foreground">
          {result.shift.transitions
            .filter((t) => t.from !== t.to)
            .map((t, i) => (
              <li key={i}>
                {t.count} moved {t.from} → {t.to}
              </li>
            ))}
          <li className="text-stage-foreground-muted">{result.shift.stayedSameCount} stayed the same</li>
        </ul>
      ) : (
        <p className="text-sm text-stage-foreground">
          Average moved from <span className="font-semibold">{result.shift.meanBefore?.toFixed(1)}</span> to{" "}
          <span className="font-semibold">{result.shift.meanAfter?.toFixed(1)}</span>
          {result.shift.meanDelta != null && (
            <span className="text-stage-foreground-muted"> ({result.shift.meanDelta >= 0 ? "+" : ""}{result.shift.meanDelta.toFixed(1)})</span>
          )}
        </p>
      )}
    </div>
  );
}
