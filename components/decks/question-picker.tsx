"use client";

import { useState, useTransition } from "react";
import { setActiveQuestion } from "@/lib/sessions/actions";
import { QUESTION_TYPE_LABELS, type QuestionTypeValue } from "@/lib/validation/deck";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

interface QuestionPickerProps {
  sessionId: string;
  questions: { id: string; prompt: string; type: QuestionTypeValue }[];
  initialActiveQuestionId: string | null;
}

/**
 * Lets the presenter open exactly one question for responses at a time,
 * independent of the Stage or of Start presenting: create the session,
 * open question 3 here, let answers come in for as long as you want, then
 * come back later and open a different one. Clicking the open question
 * again closes it, so responses can be paused without picking a new one.
 */
export function QuestionPicker({ sessionId, questions, initialActiveQuestionId }: QuestionPickerProps) {
  const toast = useToast();
  const [activeQuestionId, setActiveQuestionId] = useState(initialActiveQuestionId);
  const [pending, startTransition] = useTransition();

  function pick(questionId: string) {
    const next = activeQuestionId === questionId ? null : questionId;
    setActiveQuestionId(next);
    startTransition(async () => {
      try {
        await setActiveQuestion(sessionId, next);
      } catch (e) {
        setActiveQuestionId(activeQuestionId);
        toast.show((e as Error).message, "error");
      }
    });
  }

  if (questions.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left">
      <p className="text-sm font-medium text-foreground">Open for responses</p>
      <p className="text-xs text-foreground/50">
        Tap a question to open it. Participants can answer it right away, no need to present first.
      </p>
      <div className="mt-1 flex flex-col gap-1.5">
        {questions.map((q, i) => {
          const isActive = q.id === activeQuestionId;
          return (
            <button
              key={q.id}
              type="button"
              disabled={pending}
              onClick={() => pick(q.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60",
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border bg-background text-foreground hover:border-brand-300",
              )}
            >
              <span className="text-xs text-foreground/40">{i + 1}</span>
              <span className="flex-1 truncate">{q.prompt}</span>
              <span className="text-xs text-foreground/40">{QUESTION_TYPE_LABELS[q.type]}</span>
              {isActive && (
                <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" aria-hidden />
                  Open
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
