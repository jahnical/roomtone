import type { QuestionAggregate } from "@/lib/realtime/events";
import type { QuestionTypeValue } from "@/lib/validation/deck";
import { computeParticipation, type ParticipationSummary } from "./participation";
import { computeDivergence, type DivergenceSummary } from "./divergence";
import { computeBimodality, type BimodalitySummary } from "./bimodality";
import { computeConsensus, type ConsensusSummary } from "./consensus";
import { computeVelocity, velocityRatio, type VelocitySummary } from "./velocity";
import { clusterResponses, type TextCluster } from "./text/cluster";
import { findOutliers, type OutlierResponse } from "./outliers";
import { narrate } from "./narrate";

export interface MetricChip {
  label: string;
  value: string;
}

export interface LiveInsight {
  narration: string;
  chips: MetricChip[];
  participation: ParticipationSummary;
  divergence?: DivergenceSummary;
  bimodality?: BimodalitySummary;
  consensus?: ConsensusSummary;
  clusters?: TextCluster[];
  outliers?: OutlierResponse[];
  velocity?: VelocitySummary;
  velocityRatioValue?: number | null;
}

interface LiveQuestion {
  type: QuestionTypeValue;
  options: { id: string; label: string }[];
}

function toMs(respondedAt: string[]): number[] {
  return respondedAt.map((t) => new Date(t).getTime());
}

/**
 * Ties every lib/insight/* primitive together into what the Stage actually
 * renders: a one-line narration, a handful of metric chips, and the
 * detail an insight drawer can expand into. Pure and synchronous — all its
 * inputs are already sitting in the Stage's React state from the SSE
 * stream, so this is cheap to recompute on every update rather than
 * needing its own caching layer.
 */
export function computeLiveInsight(
  question: LiveQuestion,
  aggregate: QuestionAggregate | undefined,
  participantCount: number,
  baselineMsToHalf: number[] = [],
): LiveInsight {
  const responded = aggregate && "total" in aggregate ? aggregate.total : 0;
  const participation = computeParticipation(participantCount, responded);

  if (!aggregate || aggregate.type === "QNA") {
    return {
      narration: narrate({ questionType: question.type, participation }),
      chips: [],
      participation,
    };
  }

  const velocity = computeVelocity(toMs(aggregate.respondedAt));
  const ratio = velocityRatio(velocity.msToHalf, baselineMsToHalf);
  const respondedPct = `${Math.round(participation.responseRate * 100)}%`;

  switch (aggregate.type) {
    case "MULTIPLE_CHOICE": {
      const divergence = computeDivergence(aggregate.options.map((o) => o.count));
      const topOptions = [...aggregate.options]
        .filter((o) => o.count > 0)
        .sort((a, b) => b.count - a.count)
        .map((o) => ({ label: o.label, pct: aggregate.total > 0 ? o.count / aggregate.total : 0 }));

      return {
        narration: narrate({
          questionType: "MULTIPLE_CHOICE",
          participation,
          divergence,
          topOptions,
          velocityRatio: ratio,
        }),
        chips: [
          { label: "Divergence", value: divergence.entropy.toFixed(2) },
          { label: "Responded", value: respondedPct },
        ],
        participation,
        divergence,
        velocity,
        velocityRatioValue: ratio,
      };
    }

    case "SCALE": {
      const consensus = computeConsensus(aggregate.counts, aggregate.min, aggregate.max);
      const bimodality = computeBimodality(aggregate.counts);
      const chips: MetricChip[] = [
        { label: "Average", value: consensus.mean != null ? consensus.mean.toFixed(1) : "–" },
        { label: "Responded", value: respondedPct },
      ];
      if (bimodality.isBimodal) chips.push({ label: "Shape", value: "Split (bimodal)" });

      return {
        narration: narrate({ questionType: "SCALE", participation, consensus, bimodality, velocityRatio: ratio }),
        chips,
        participation,
        bimodality,
        consensus,
        velocity,
        velocityRatioValue: ratio,
      };
    }

    case "OPEN_TEXT": {
      const clusters = clusterResponses(aggregate.responses.map((r) => r.text));
      const outliers = findOutliers(clusters, aggregate.total);
      const namedThemes = clusters.filter((c) => c.exemplar !== "Other");
      const topTheme = namedThemes[0];
      const base = narrate({ questionType: "OPEN_TEXT", participation, velocityRatio: ratio });
      const themeNote =
        topTheme && namedThemes.length > 1 ? ` Top theme: "${topTheme.exemplar}" (${topTheme.count}).` : "";

      return {
        narration: base + themeNote,
        chips: [
          { label: "Responded", value: respondedPct },
          { label: "Themes", value: String(namedThemes.length) },
        ],
        participation,
        clusters,
        outliers,
        velocity,
        velocityRatioValue: ratio,
      };
    }

    case "WORD_CLOUD": {
      return {
        narration: narrate({ questionType: "WORD_CLOUD", participation, velocityRatio: ratio }),
        chips: [{ label: "Responded", value: respondedPct }],
        participation,
        velocity,
        velocityRatioValue: ratio,
      };
    }
  }
}
