"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { deleteQuestion, moveQuestion, updateQuestion } from "@/lib/decks/actions";
import { QUESTION_TYPE_LABELS, type QuestionTypeValue } from "@/lib/validation/deck";
import { QuestionForm, type EarlierQuestion, type QuestionFormInitialValues } from "./question-form";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export interface QuestionRowData {
  id: string;
  prompt: string;
  type: QuestionTypeValue;
  pairedWithId: string | null;
  options: { label: string }[];
  config: QuestionFormInitialValues["config"];
  isFirst: boolean;
  isLast: boolean;
}

export function QuestionRow({
  question,
  index,
  earlierQuestions,
}: {
  question: QuestionRowData;
  index: number;
  earlierQuestions: EarlierQuestion[];
}) {
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  if (editing) {
    return (
      <div className="rounded-xl border border-brand-300 bg-surface p-4">
        <QuestionForm
          action={updateQuestion.bind(null, question.id)}
          initialValues={{
            prompt: question.prompt,
            type: question.type,
            pairedWithId: question.pairedWithId,
            options: question.options.map((o) => o.label),
            config: question.config,
          }}
          earlierQuestions={earlierQuestions}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSuccess={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-1 pt-1">
        <button
          type="button"
          disabled={question.isFirst}
          aria-label="Move up"
          onClick={() => moveQuestion(question.id, "up").catch((e) => toast.show((e as Error).message, "error"))}
          className="rounded p-0.5 text-foreground/30 hover:text-foreground disabled:opacity-20"
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          disabled={question.isLast}
          aria-label="Move down"
          onClick={() => moveQuestion(question.id, "down").catch((e) => toast.show((e as Error).message, "error"))}
          className="rounded p-0.5 text-foreground/30 hover:text-foreground disabled:opacity-20"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600">
          <span>{index + 1}</span>
          <span className="text-foreground/30">·</span>
          <span>{QUESTION_TYPE_LABELS[question.type]}</span>
        </div>
        <p className="mt-1 text-sm text-foreground">{question.prompt}</p>
        {question.type === "MULTIPLE_CHOICE" && question.options.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {question.options.map((o, i) => (
              <li key={i} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-foreground/70">
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(true)}>
          <Pencil size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete"
          onClick={async () => {
            const ok = await confirm({
              title: "Delete this question?",
              message: "This can't be undone.",
              confirmLabel: "Delete",
              destructive: true,
            });
            if (ok) {
              deleteQuestion(question.id).catch((e) => toast.show((e as Error).message, "error"));
            }
          }}
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
      </div>
    </div>
  );
}
