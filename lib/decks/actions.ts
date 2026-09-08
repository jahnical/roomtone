"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import {
  deckSchema,
  extractRawQuestionValues,
  multipleChoiceConfigSchema,
  optionLabelSchema,
  questionPromptSchema,
  scaleConfigSchema,
  type QuestionFormValues,
  type QuestionTypeValue,
} from "@/lib/validation/deck";

export interface FormActionState {
  error?: string;
}

export interface QuestionFormActionState {
  error?: string;
  values?: QuestionFormValues;
}

async function requireDeckOwnership(deckId: string, userId: string) {
  const deck = await prisma.deck.findFirst({ where: { id: deckId, userId } });
  if (!deck) {
    throw new Error("NOT_FOUND");
  }
  return deck;
}

async function requireQuestionOwnership(questionId: string, userId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, deck: { userId } },
    include: { deck: true },
  });
  if (!question) {
    throw new Error("NOT_FOUND");
  }
  return question;
}

export async function createDeck(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = deckSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const deck = await prisma.deck.create({
    data: {
      userId: session.userId,
      title: parsed.data.title,
      description: parsed.data.description || null,
    },
  });

  redirect(`/console/decks/${deck.id}`);
}

export async function updateDeckDetails(
  deckId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const session = await requireSession();
  await requireDeckOwnership(deckId, session.userId);

  const parsed = deckSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.deck.update({
    where: { id: deckId },
    data: { title: parsed.data.title, description: parsed.data.description || null },
  });
  revalidatePath(`/console/decks/${deckId}`);
  return {};
}

export async function deleteDeck(deckId: string) {
  const session = await requireSession();
  await requireDeckOwnership(deckId, session.userId);
  await prisma.deck.delete({ where: { id: deckId } });
  redirect("/console");
}

/** Extracts and validates the type-specific config + options from a question form submission. Shared by create and update. Every error path echoes back the raw submitted values — see QuestionFormValues for why. */
async function parseQuestionSubmission(formData: FormData) {
  const values = extractRawQuestionValues(formData);

  const base = questionPromptSchema.safeParse({
    prompt: formData.get("prompt"),
    type: formData.get("type"),
    pairedWithId: formData.get("pairedWithId"),
  });
  if (!base.success) {
    return { error: base.error.issues[0]?.message ?? "Invalid input.", values } as const;
  }
  const { prompt, type, pairedWithId } = base.data;

  let config: Prisma.InputJsonValue = {};
  let options: string[] = [];

  if (type === "SCALE") {
    const parsed = scaleConfigSchema.safeParse({
      min: formData.get("min") ?? 1,
      max: formData.get("max") ?? 5,
      minLabel: formData.get("minLabel"),
      maxLabel: formData.get("maxLabel"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid scale settings.", values } as const;
    }
    config = parsed.data;
  } else if (type === "MULTIPLE_CHOICE") {
    const parsed = multipleChoiceConfigSchema.safeParse({
      allowMultiple: formData.get("allowMultiple") === "on",
    });
    if (!parsed.success) {
      return { error: "Invalid multiple choice settings.", values } as const;
    }
    config = parsed.data;

    const rawOptions = formData.getAll("option").map((v) => String(v).trim());
    const validated: string[] = [];
    for (const raw of rawOptions) {
      if (!raw) continue;
      const check = optionLabelSchema.safeParse(raw);
      if (check.success) validated.push(check.data);
    }
    if (validated.length < 2) {
      return { error: "Multiple choice needs at least 2 non-empty options.", values } as const;
    }
    options = validated;
  }

  return {
    prompt,
    type: type as QuestionTypeValue,
    config,
    options,
    pairedWithId: pairedWithId || null,
  } as const;
}

export async function createQuestion(
  deckId: string,
  _prevState: QuestionFormActionState,
  formData: FormData,
): Promise<QuestionFormActionState> {
  const session = await requireSession();
  await requireDeckOwnership(deckId, session.userId);

  const parsed = await parseQuestionSubmission(formData);
  if ("error" in parsed) return { error: parsed.error, values: parsed.values };

  const lastQuestion = await prisma.question.findFirst({
    where: { deckId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (lastQuestion?.order ?? -1) + 1;

  await prisma.question.create({
    data: {
      deckId,
      order: nextOrder,
      type: parsed.type,
      prompt: parsed.prompt,
      config: parsed.config,
      pairedWithId: parsed.pairedWithId,
      options: {
        create: parsed.options.map((label, i) => ({ order: i, label })),
      },
    },
  });

  revalidatePath(`/console/decks/${deckId}`);
  return {};
}

export async function updateQuestion(
  questionId: string,
  _prevState: QuestionFormActionState,
  formData: FormData,
): Promise<QuestionFormActionState> {
  const session = await requireSession();
  const existing = await requireQuestionOwnership(questionId, session.userId);

  const parsed = await parseQuestionSubmission(formData);
  if ("error" in parsed) return { error: parsed.error, values: parsed.values };

  // Options are fully replaced rather than diffed. Existing Response rows
  // pointing at the old options have their optionId set to null (see the
  // Response.option relation's onDelete: SetNull) rather than being
  // deleted — acceptable because decks are meant to be edited before they
  // go live, not mid- or post-session.
  await prisma.$transaction([
    prisma.option.deleteMany({ where: { questionId } }),
    prisma.question.update({
      where: { id: questionId },
      data: {
        type: parsed.type,
        prompt: parsed.prompt,
        config: parsed.config,
        pairedWithId: parsed.pairedWithId,
        options: {
          create: parsed.options.map((label, i) => ({ order: i, label })),
        },
      },
    }),
  ]);

  revalidatePath(`/console/decks/${existing.deckId}`);
  return {};
}

export async function deleteQuestion(questionId: string) {
  const session = await requireSession();
  const existing = await requireQuestionOwnership(questionId, session.userId);

  await prisma.question.delete({ where: { id: questionId } });

  // Re-sequence remaining questions so `order` stays a dense 0..n-1 run.
  const remaining = await prisma.question.findMany({
    where: { deckId: existing.deckId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((q, i) => prisma.question.update({ where: { id: q.id }, data: { order: i } })),
  );

  revalidatePath(`/console/decks/${existing.deckId}`);
}

export async function moveQuestion(questionId: string, direction: "up" | "down") {
  const session = await requireSession();
  const existing = await requireQuestionOwnership(questionId, session.userId);

  const neighbor = await prisma.question.findFirst({
    where: {
      deckId: existing.deckId,
      order: direction === "up" ? { lt: existing.order } : { gt: existing.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return; // already at the edge

  await prisma.$transaction([
    prisma.question.update({ where: { id: existing.id }, data: { order: neighbor.order } }),
    prisma.question.update({ where: { id: neighbor.id }, data: { order: existing.order } }),
  ]);

  revalidatePath(`/console/decks/${existing.deckId}`);
}
