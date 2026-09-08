"use client";

import { useState } from "react";
import { createQuestion } from "@/lib/decks/actions";
import { QuestionForm, type EarlierQuestion } from "./question-form";
import { Button } from "@/components/ui/button";

export function AddQuestionPanel({ deckId, earlierQuestions }: { deckId: string; earlierQuestions: EarlierQuestion[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline">
        Add question
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-brand-300 bg-surface p-4">
      <QuestionForm
        action={createQuestion.bind(null, deckId)}
        earlierQuestions={earlierQuestions}
        submitLabel="Add question"
        onCancel={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
      />
    </div>
  );
}
