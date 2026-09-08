import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hub } from "@/lib/realtime/hub";
import { computeQuestionAggregate } from "@/lib/realtime/aggregate";

const respondSchema = z.object({
  code: z.string().trim().min(1).max(20),
  token: z.string().trim().min(1).max(200),
  questionId: z.string().trim().min(1),
  optionId: z.string().trim().optional(),
  valueText: z.string().trim().optional(),
  valueNumber: z.number().optional(),
});

const WORD_CLOUD_MAX_LENGTH = 60;
const OPEN_TEXT_MAX_LENGTH = 500;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid response." }, { status: 400 });
  }
  const { code, token, questionId, optionId, valueText, valueNumber } = parsed.data;
  const normalizedCode = code.toUpperCase();

  const session = await prisma.session.findUnique({
    where: { code: normalizedCode },
    select: { id: true, state: true, activeQuestionId: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Unknown session code." }, { status: 404 });
  }
  // DRAFT is allowed on purpose: the presenter can open a single question
  // for responses straight from the session lobby, well before (or instead
  // of) ever clicking Start presenting. Only a truly finished session
  // rejects new responses.
  if (session.state === "ENDED") {
    return NextResponse.json({ error: "This session has ended." }, { status: 409 });
  }
  // Only the one question the presenter currently has open accepts answers,
  // even if a participant's client is stale about which one that is (see
  // setActiveQuestion in lib/sessions/actions.ts): a deck can hold several
  // questions the presenter hasn't opened yet, or has since closed.
  if (questionId !== session.activeQuestionId) {
    return NextResponse.json({ error: "This question isn't open for responses right now." }, { status: 409 });
  }

  const question = await prisma.question.findFirst({
    where: { id: questionId, deck: { sessions: { some: { id: session.id } } } },
    include: { options: true },
  });
  if (!question) {
    return NextResponse.json({ error: "Unknown question." }, { status: 404 });
  }

  // Validated per the question's *actual* type from the database, never
  // whatever the client claims — a tampered request can't write a fake
  // option or an out-of-range scale value.
  let data: { optionId?: string; valueText?: string; valueNumber?: number };
  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      const option = optionId ? question.options.find((o) => o.id === optionId) : undefined;
      if (!option) {
        return NextResponse.json({ error: "Select one of the listed options." }, { status: 400 });
      }
      data = { optionId: option.id };
      break;
    }
    case "WORD_CLOUD": {
      const text = valueText?.trim();
      if (!text) {
        return NextResponse.json({ error: "Enter a word or short phrase." }, { status: 400 });
      }
      data = { valueText: text.slice(0, WORD_CLOUD_MAX_LENGTH) };
      break;
    }
    case "OPEN_TEXT": {
      const text = valueText?.trim();
      if (!text) {
        return NextResponse.json({ error: "Enter a response." }, { status: 400 });
      }
      data = { valueText: text.slice(0, OPEN_TEXT_MAX_LENGTH) };
      break;
    }
    case "SCALE": {
      const config = question.config as { min?: number; max?: number };
      const min = config.min ?? 1;
      const max = config.max ?? 5;
      if (valueNumber === undefined || !Number.isFinite(valueNumber) || valueNumber < min || valueNumber > max) {
        return NextResponse.json({ error: `Pick a value between ${min} and ${max}.` }, { status: 400 });
      }
      data = { valueNumber };
      break;
    }
    case "QNA":
      return NextResponse.json({ error: "Q&A submissions aren't available yet." }, { status: 400 });
  }

  const participant = await prisma.participant.upsert({
    where: { sessionId_token: { sessionId: session.id, token } },
    update: {},
    create: { sessionId: session.id, token },
  });

  // Upsert, not create: re-answering the same question overwrites the
  // participant's previous answer rather than erroring, per the
  // @@unique([questionId, participantId]) constraint on Response.
  await prisma.response.upsert({
    where: { questionId_participantId: { questionId, participantId: participant.id } },
    update: { ...data, optionId: data.optionId ?? null, valueText: data.valueText ?? null, valueNumber: data.valueNumber ?? null },
    create: { sessionId: session.id, questionId, participantId: participant.id, ...data },
  });

  const aggregate = await computeQuestionAggregate(session.id, questionId);
  if (aggregate) {
    hub.publish(normalizedCode, { type: "question-update", questionId, aggregate });
  }

  return NextResponse.json({ ok: true });
}
