"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { QuestionFormActionState } from "@/lib/decks/actions";
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type QuestionTypeValue } from "@/lib/validation/deck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export interface QuestionFormInitialValues {
  prompt: string;
  type: QuestionTypeValue;
  pairedWithId: string | null;
  options: string[];
  config: {
    allowMultiple?: boolean;
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
  };
}

export interface EarlierQuestion {
  id: string;
  prompt: string;
}

interface QuestionFormProps {
  action: (state: QuestionFormActionState, formData: FormData) => Promise<QuestionFormActionState>;
  initialValues?: QuestionFormInitialValues;
  earlierQuestions: EarlierQuestion[];
  submitLabel: string;
  onCancel?: () => void;
  /** Called after a submission succeeds (no error came back). Typically used to collapse an edit row back to its display state. */
  onSuccess?: () => void;
}

const initialState: QuestionFormActionState = {};

function toFieldState(initialValues?: QuestionFormInitialValues) {
  return {
    prompt: initialValues?.prompt ?? "",
    type: initialValues?.type ?? ("WORD_CLOUD" as QuestionTypeValue),
    pairedWithId: initialValues?.pairedWithId ?? "",
    options: initialValues?.options && initialValues.options.length > 0 ? initialValues.options : ["", ""],
    allowMultiple: initialValues?.config.allowMultiple ?? false,
    min: String(initialValues?.config.min ?? 1),
    max: String(initialValues?.config.max ?? 5),
    minLabel: initialValues?.config.minLabel ?? "",
    maxLabel: initialValues?.config.maxLabel ?? "",
  };
}

/**
 * Fully controlled by design — every field's value comes from local state,
 * never from the DOM's own defaultValue/defaultChecked. This is required,
 * not just a style preference: React resets uncontrolled fields after a
 * `<form action={...}>` submission (including on validation failure) by
 * writing directly to the DOM, which does not trigger a React re-render.
 * A field controlled by state that didn't itself change (e.g. the type
 * `<select>`) would silently desync from what the browser would actually
 * submit next. Resyncing all fields from the action's echoed-back `values`
 * on every result (see the effect below) keeps state and DOM consistent
 * across repeated failed submissions.
 */
export function QuestionForm({
  action,
  initialValues,
  earlierQuestions,
  submitLabel,
  onCancel,
  onSuccess,
}: QuestionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [fields, setFields] = useState(() => toFieldState(initialValues));

  // onSuccess fires a callback in the *parent* (e.g. collapsing an edit row),
  // which must happen from an effect, not from the render-time state-sync
  // block below — updating a different component's state while this one is
  // rendering is exactly what that pattern must avoid. The ref sidesteps
  // needing `onSuccess` in the dependency array (it's often a fresh inline
  // function each render) without risking a stale closure.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  useEffect(() => {
    if (state !== initialState && !state?.error) {
      onSuccessRef.current?.();
    }
  }, [state]);

  // Resync local field state whenever a *new* action result comes back —
  // using React's "adjusting state during render" pattern (comparing
  // against the last state we've seen) rather than useEffect, so this
  // doesn't cost an extra render pass. See the QuestionForm doc comment for
  // why this resync needs to happen at all.
  const [syncedState, setSyncedState] = useState(state);
  if (state !== syncedState) {
    setSyncedState(state);
    if (state?.values) {
      setFields({
        prompt: state.values.prompt,
        type: (state.values.type as QuestionTypeValue) || "WORD_CLOUD",
        pairedWithId: state.values.pairedWithId,
        options: state.values.options.length > 0 ? state.values.options : ["", ""],
        allowMultiple: state.values.allowMultiple,
        min: state.values.min || "1",
        max: state.values.max || "5",
        minLabel: state.values.minLabel,
        maxLabel: state.values.maxLabel,
      });
    }
  }

  const { prompt, type, pairedWithId, options, allowMultiple, min, max, minLabel, maxLabel } = fields;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            name="prompt"
            required
            value={prompt}
            onChange={(e) => setFields((f) => ({ ...f, prompt: e.target.value }))}
            placeholder="What should we build next?"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setFields((f) => ({ ...f, type: e.target.value as QuestionTypeValue }))}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {type === "MULTIPLE_CHOICE" && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
          <Label>Options</Label>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                name="option"
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setFields((f) => ({ ...f, options: next }));
                }}
                placeholder={`Option ${i + 1}`}
                required
              />
              {options.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => setFields((f) => ({ ...f, options: options.filter((_, idx) => idx !== i) }))}
                  className="rounded-md p-2 text-foreground/40 hover:bg-surface hover:text-foreground"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setFields((f) => ({ ...f, options: [...options, ""] }))}
          >
            Add option
          </Button>
          <label className="mt-1 flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              name="allowMultiple"
              checked={allowMultiple}
              onChange={(e) => setFields((f) => ({ ...f, allowMultiple: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-brand-600"
            />
            Allow selecting more than one option
          </label>
        </div>
      )}

      {type === "SCALE" && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min">Min</Label>
            <Input
              id="min"
              name="min"
              type="number"
              value={min}
              onChange={(e) => setFields((f) => ({ ...f, min: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max">Max</Label>
            <Input
              id="max"
              name="max"
              type="number"
              value={max}
              onChange={(e) => setFields((f) => ({ ...f, max: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minLabel">Min label</Label>
            <Input
              id="minLabel"
              name="minLabel"
              value={minLabel}
              onChange={(e) => setFields((f) => ({ ...f, minLabel: e.target.value }))}
              placeholder="Not confident"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxLabel">Max label</Label>
            <Input
              id="maxLabel"
              name="maxLabel"
              value={maxLabel}
              onChange={(e) => setFields((f) => ({ ...f, maxLabel: e.target.value }))}
              placeholder="Very confident"
            />
          </div>
        </div>
      )}

      {earlierQuestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pairedWithId">
            Pair with an earlier question <span className="font-normal text-foreground/40">(optional, for before/after comparison)</span>
          </Label>
          <Select
            id="pairedWithId"
            name="pairedWithId"
            value={pairedWithId}
            onChange={(e) => setFields((f) => ({ ...f, pairedWithId: e.target.value }))}
          >
            <option value="">No pairing</option>
            {earlierQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.prompt.slice(0, 60)}
              </option>
            ))}
          </Select>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
