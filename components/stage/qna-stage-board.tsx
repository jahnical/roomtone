"use client";

import { ArrowUp, Check } from "lucide-react";
import { toggleQnaAnswered } from "@/lib/sessions/actions";
import type { QnaItemPayload } from "@/lib/realtime/events";
import { cn } from "@/lib/utils/cn";

export function QnaStageBoard({ sessionId, items }: { sessionId: string; items: QnaItemPayload[] }) {
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xl text-stage-foreground-muted">
        Waiting for questions…
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto py-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-center gap-4 rounded-xl border border-stage-border bg-stage-bg-raised px-4 py-3",
            item.answered && "opacity-50",
          )}
        >
          <span className="flex shrink-0 flex-col items-center rounded-lg bg-stage-bg px-2.5 py-1.5 text-sm font-semibold text-stage-foreground">
            <ArrowUp size={14} />
            {item.upvotes}
          </span>
          <span className="flex-1 text-lg text-stage-foreground">{item.text}</span>
          <button
            type="button"
            aria-label={item.answered ? "Mark unanswered" : "Mark answered"}
            onClick={() => toggleQnaAnswered(sessionId, item.id).catch(() => {})}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              item.answered
                ? "border-stage-cyan text-stage-cyan"
                : "border-stage-border text-stage-foreground-muted hover:border-stage-cyan hover:text-stage-cyan",
            )}
          >
            <Check size={14} />
            {item.answered ? "Answered" : "Mark answered"}
          </button>
        </div>
      ))}
    </div>
  );
}
