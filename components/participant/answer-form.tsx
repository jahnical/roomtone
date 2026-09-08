"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { StageQuestion } from "@/components/stage/stage";
import type { QnaItemPayload } from "@/lib/realtime/events";
import { QnaBoard } from "./qna-board";

interface AnswerFormProps {
  question: StageQuestion;
  onSubmit: (value: { optionId?: string; valueText?: string; valueNumber?: number }) => Promise<void>;
  submitting: boolean;
  code: string;
  token: string | null;
  qnaItems: QnaItemPayload[];
}

/** One form per question type, all sharing the same submit contract: the participant's answer form for whatever question is currently active. The parent shows the "submitted" confirmation, not this component. QNA is the exception: it has its own submit/list flow (see QnaBoard) rather than the shared onSubmit contract, since a Q&A wall is a list you keep interacting with, not a single answer-then-done. */
export function AnswerForm({ question, onSubmit, submitting, code, token, qnaItems }: AnswerFormProps) {
  switch (question.type) {
    case "MULTIPLE_CHOICE":
      return <MultipleChoiceAnswer question={question} onSubmit={onSubmit} submitting={submitting} />;
    case "WORD_CLOUD":
      return <ShortTextAnswer onSubmit={onSubmit} submitting={submitting} maxLength={60} placeholder="One or two words…" />;
    case "OPEN_TEXT":
      return <LongTextAnswer onSubmit={onSubmit} submitting={submitting} />;
    case "SCALE":
      return <ScaleAnswer question={question} onSubmit={onSubmit} submitting={submitting} />;
    case "QNA":
      return <QnaBoard code={code} token={token} items={qnaItems} />;
  }
}

function MultipleChoiceAnswer({
  question,
  onSubmit,
  submitting,
}: {
  question: StageQuestion;
  onSubmit: AnswerFormProps["onSubmit"];
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {question.options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={submitting}
          onClick={() => {
            setSelected(opt.id);
            onSubmit({ optionId: opt.id });
          }}
          className={cn(
            "rounded-xl border px-5 py-4 text-left text-lg font-medium transition-colors",
            selected === opt.id
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-brand-100 bg-white text-brand-950 hover:border-brand-300",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ShortTextAnswer({
  onSubmit,
  submitting,
  maxLength,
  placeholder,
}: {
  onSubmit: AnswerFormProps["onSubmit"];
  submitting: boolean;
  maxLength: number;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit({ valueText: value.trim() });
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus
        className="h-14 border-brand-100 bg-white text-center text-xl text-brand-950 placeholder:text-brand-950/30"
      />
      <Button type="submit" size="lg" disabled={submitting || !value.trim()}>
        {submitting ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}

function LongTextAnswer({ onSubmit, submitting }: { onSubmit: AnswerFormProps["onSubmit"]; submitting: boolean }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit({ valueText: value.trim() });
      }}
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={500}
        placeholder="Type your response…"
        autoFocus
        className="min-h-32 border-brand-100 bg-white text-lg text-brand-950 placeholder:text-brand-950/30"
      />
      <Button type="submit" size="lg" disabled={submitting || !value.trim()}>
        {submitting ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}

function ScaleAnswer({
  question,
  onSubmit,
  submitting,
}: {
  question: StageQuestion;
  onSubmit: AnswerFormProps["onSubmit"];
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const min = question.config.min ?? 1;
  const max = question.config.max ?? 5;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="flex flex-col gap-3">
      {(question.config.minLabel || question.config.maxLabel) && (
        <div className="flex justify-between text-sm text-brand-950/50">
          <span>{question.config.minLabel}</span>
          <span>{question.config.maxLabel}</span>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            disabled={submitting}
            onClick={() => {
              setSelected(v);
              onSubmit({ valueNumber: v });
            }}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border text-xl font-semibold transition-colors",
              selected === v
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-brand-100 bg-white text-brand-950 hover:border-brand-300",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
