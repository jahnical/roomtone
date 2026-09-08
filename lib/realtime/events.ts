import type { SessionState } from "@prisma/client";

/**
 * One aggregate shape per question type — what the Stage and participant
 * client render from. `respondedAt` (ISO timestamps, one per response, any
 * order) rides along on every data-bearing variant so lib/insight/live.ts
 * can compute response velocity client-side without a second round trip —
 * it's the same data already being fetched for the counts/text, just not
 * discarded before it reaches the client.
 */
export type QuestionAggregate =
  | { type: "MULTIPLE_CHOICE"; total: number; options: { optionId: string; label: string; count: number }[]; respondedAt: string[] }
  | { type: "WORD_CLOUD"; total: number; words: { text: string; count: number }[]; respondedAt: string[] }
  | { type: "OPEN_TEXT"; total: number; responses: { id: string; text: string; createdAt: string }[]; respondedAt: string[] }
  | {
      type: "SCALE";
      total: number;
      min: number;
      max: number;
      mean: number | null;
      counts: { value: number; count: number }[];
      respondedAt: string[];
    }
  | { type: "QNA" };

export interface QnaItemPayload {
  id: string;
  text: string;
  upvotes: number;
  answered: boolean;
  createdAt: string;
}

export type RealtimeEvent =
  | { type: "question-update"; questionId: string; aggregate: QuestionAggregate }
  | { type: "participant-count"; count: number }
  | { type: "session-state"; state: SessionState; activeQuestionId: string | null }
  // Q&A is session-wide, not tied to a specific question (see QnaItem in
  // schema.prisma), so unlike question-update this always carries the full
  // current list rather than a diff — classroom-sized Q&A walls are small
  // enough that this is simpler and just as cheap.
  | { type: "qna-update"; items: QnaItemPayload[] };
