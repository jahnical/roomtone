import type { ParticipationSummary } from "./participation";
import type { DivergenceSummary } from "./divergence";
import type { BimodalitySummary } from "./bimodality";
import type { ConsensusSummary } from "./consensus";

export interface NarrationInput {
  questionType: "MULTIPLE_CHOICE" | "SCALE" | "WORD_CLOUD" | "OPEN_TEXT" | "QNA";
  participation: ParticipationSummary;
  divergence?: DivergenceSummary;
  topOptions?: { label: string; pct: number }[]; // sorted desc, for MULTIPLE_CHOICE
  bimodality?: BimodalitySummary;
  consensus?: ConsensusSummary;
  velocityRatio?: number | null;
}

const SPLIT_ENTROPY_THRESHOLD = 0.75;
const CONSENSUS_ENTROPY_THRESHOLD = 0.35;
const SLOW_VELOCITY_THRESHOLD = 1.5;
const FAST_VELOCITY_THRESHOLD = 0.6;

function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * Template-composed, fully deterministic — no LLM involved. This is what
 * makes the Stage's one-line "room state" possible without an AI provider
 * configured; lib/ai/* (M6) only ever adds optional theme *labels* on top
 * of what this already says, never replaces it.
 */
export function narrate(input: NarrationInput): string {
  const parts: string[] = [];
  const { joined, responded, responseRate } = input.participation;
  parts.push(`${responded} of ${joined} responded (${pct(responseRate)}%).`);

  if (input.questionType === "MULTIPLE_CHOICE" && input.divergence && input.topOptions) {
    const [first, second] = input.topOptions;
    if (input.divergence.entropy >= SPLIT_ENTROPY_THRESHOLD) {
      if (first && second) {
        parts.push(
          `The room is split, divergence ${input.divergence.entropy.toFixed(2)}, clustering at ${first.label} (${pct(first.pct)}%) and ${second.label} (${pct(second.pct)}%).`,
        );
      } else {
        parts.push(`The room is split, divergence ${input.divergence.entropy.toFixed(2)}.`);
      }
    } else if (input.divergence.entropy <= CONSENSUS_ENTROPY_THRESHOLD && first) {
      parts.push(`Strong consensus around ${first.label} (${pct(first.pct)}%).`);
    } else {
      parts.push(`Moderate spread across the options.`);
    }
  }

  if (input.questionType === "SCALE" && input.consensus) {
    const c = input.consensus;
    if (c.mean != null) {
      parts.push(`Average ${c.mean.toFixed(1)} of ${c.max}.`);
    }
    if (input.bimodality?.isBimodal) {
      parts.push(`The average hides a split: responses cluster at both ends rather than the middle.`);
    }
  }

  if (input.velocityRatio != null) {
    if (input.velocityRatio >= SLOW_VELOCITY_THRESHOLD) {
      parts.push(
        `Answers arrived ${input.velocityRatio.toFixed(1)}× slower than your session average, which usually means the prompt was ambiguous.`,
      );
    } else if (input.velocityRatio > 0 && input.velocityRatio <= FAST_VELOCITY_THRESHOLD) {
      parts.push(`Answers arrived ${(1 / input.velocityRatio).toFixed(1)}× faster than usual.`);
    }
  }

  return parts.join(" ");
}
