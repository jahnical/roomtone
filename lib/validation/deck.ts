import { z } from "zod";

export const QUESTION_TYPES = [
  "WORD_CLOUD",
  "MULTIPLE_CHOICE",
  "OPEN_TEXT",
  "SCALE",
  "QNA",
] as const;

export type QuestionTypeValue = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  WORD_CLOUD: "Word cloud",
  MULTIPLE_CHOICE: "Multiple choice",
  OPEN_TEXT: "Open text",
  SCALE: "Scale (1-5 style rating)",
  QNA: "Q&A wall",
};

export const deckSchema = z.object({
  title: z.string().trim().min(1, "Give the deck a title").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const questionPromptSchema = z.object({
  prompt: z.string().trim().min(1, "Enter a prompt").max(500),
  type: z.enum(QUESTION_TYPES),
  // Pre/post pairing: id of an earlier question in the same deck this one
  // should be compared against. `formData.get()` returns `null` (not
  // `undefined`) both when the field is empty and — crucially — when the
  // pairing <select> isn't rendered at all (a deck's first question has no
  // earlier questions to pair with). Zod's `.optional()` only accepts
  // `undefined`, so this needs `.nullish()` to accept the `null` that a
  // missing form field actually produces.
  pairedWithId: z.string().trim().nullish().or(z.literal("")),
});

export const scaleConfigSchema = z
  .object({
    min: z.coerce.number().int().min(0).max(9),
    max: z.coerce.number().int().min(1).max(10),
    minLabel: z.string().trim().max(60).optional().or(z.literal("")),
    maxLabel: z.string().trim().max(60).optional().or(z.literal("")),
  })
  .refine((v) => v.max > v.min, { message: "Max must be greater than min", path: ["max"] });

export const multipleChoiceConfigSchema = z.object({
  allowMultiple: z.coerce.boolean().default(false),
});

export const optionLabelSchema = z.string().trim().min(1).max(200);

/**
 * Raw (unvalidated) snapshot of everything a question form submits. Echoed
 * back by createQuestion/updateQuestion alongside a validation error so the
 * client can restore exactly what the user typed.
 *
 * This exists because React resets uncontrolled form fields after a
 * `<form action={...}>` Server Action submission completes — including on
 * validation failure — and does so by mutating the DOM directly rather than
 * through a state update. A `<select>` bound with a React-controlled
 * `value` prop doesn't get corrected back until something changes its
 * state, so without echoing values back and explicitly resyncing local
 * state from them, a rejected submission can leave the visible "which
 * fields are shown" state (driven by React) out of sync with what the
 * browser would actually submit next (driven by the reset DOM).
 */
export interface QuestionFormValues {
  prompt: string;
  type: string;
  pairedWithId: string;
  options: string[];
  allowMultiple: boolean;
  min: string;
  max: string;
  minLabel: string;
  maxLabel: string;
}

export function extractRawQuestionValues(formData: FormData): QuestionFormValues {
  return {
    prompt: String(formData.get("prompt") ?? ""),
    type: String(formData.get("type") ?? "WORD_CLOUD"),
    pairedWithId: String(formData.get("pairedWithId") ?? ""),
    options: formData.getAll("option").map((v) => String(v)),
    allowMultiple: formData.get("allowMultiple") === "on",
    min: String(formData.get("min") ?? ""),
    max: String(formData.get("max") ?? ""),
    minLabel: String(formData.get("minLabel") ?? ""),
    maxLabel: String(formData.get("maxLabel") ?? ""),
  };
}
