"use client";

import { useState } from "react";
import type { LiveInsight } from "@/lib/insight/live";
import type { QuestionTypeValue } from "@/lib/validation/deck";
import { generateThemeLabels, generateMisconception } from "@/lib/ai/actions";
import { MIN_CLUSTER_SIZE_TO_LABEL } from "@/lib/ai/constants";
import type { MisconceptionSuggestion } from "@/lib/ai/insight";
import { Button } from "@/components/ui/button";

interface InsightDrawerProps {
  questionType: QuestionTypeValue;
  insight: LiveInsight;
  sessionId: string;
  questionId: string;
  aiEnabled: boolean;
}

/** The 'I' keyboard shortcut's detail panel — the numbers behind the room-state strip's one-liner. */
export function InsightDrawer({ questionType, insight, sessionId, questionId, aiEnabled }: InsightDrawerProps) {
  return (
    <div className="absolute inset-y-0 right-0 flex w-80 flex-col gap-4 overflow-y-auto border-l border-stage-border bg-stage-bg-raised p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stage-foreground-muted">Insight</h2>
        <p className="mt-1 text-sm text-stage-foreground">{insight.narration}</p>
      </div>

      {insight.divergence && (
        <Section title="Divergence">
          <Stat label="Entropy (0=unanimous, 1=split)" value={insight.divergence.entropy.toFixed(2)} />
          <Stat label="Concentration (HHI)" value={insight.divergence.hhi.toFixed(2)} />
        </Section>
      )}

      {insight.consensus && (
        <Section title="Distribution">
          <Stat label="Mean" value={insight.consensus.mean?.toFixed(2) ?? "–"} />
          <Stat label="Median" value={insight.consensus.median?.toFixed(1) ?? "–"} />
          <Stat label="SD" value={insight.consensus.sd?.toFixed(2) ?? "–"} />
          <Stat label="IQR" value={insight.consensus.iqr?.toFixed(1) ?? "–"} />
          <Stat
            label="Top / bottom box"
            value={`${Math.round((insight.consensus.topBoxPct ?? 0) * 100)}% / ${Math.round((insight.consensus.bottomBoxPct ?? 0) * 100)}%`}
          />
        </Section>
      )}

      {insight.bimodality?.coefficient != null && (
        <Section title="Shape">
          <Stat label="Bimodality coefficient" value={insight.bimodality.coefficient.toFixed(2)} />
          <Stat label="Reading" value={insight.bimodality.isBimodal ? "Two camps, not one center" : "Single center"} />
        </Section>
      )}

      {insight.clusters && insight.clusters.length > 0 && (
        <ThemesSection
          clusters={insight.clusters}
          outliers={insight.outliers ?? []}
          sessionId={sessionId}
          questionId={questionId}
          aiEnabled={aiEnabled}
        />
      )}

      {insight.velocityRatioValue != null && (
        <Section title="Speed">
          <Stat label="Vs. session average" value={`${insight.velocityRatioValue.toFixed(1)}×`} />
        </Section>
      )}

      {questionType === "WORD_CLOUD" && (
        <p className="text-sm text-stage-foreground-muted">The word cloud itself is the detail view for this question.</p>
      )}
    </div>
  );
}

function ThemesSection({
  clusters,
  outliers,
  sessionId,
  questionId,
  aiEnabled,
}: {
  clusters: NonNullable<LiveInsight["clusters"]>;
  outliers: NonNullable<LiveInsight["outliers"]>;
  sessionId: string;
  questionId: string;
  aiEnabled: boolean;
}) {
  const [labels, setLabels] = useState<Record<string, string> | null>(null);
  const [labelling, setLabelling] = useState(false);
  const [misconception, setMisconception] = useState<MisconceptionSuggestion | null>(null);
  const [findingMisconception, setFindingMisconception] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLabelableClusters = clusters.some((c) => c.count >= MIN_CLUSTER_SIZE_TO_LABEL);

  async function handleLabelThemes() {
    if (!hasLabelableClusters) {
      setError("No repeated themes yet, everyone's answers are still distinct.");
      return;
    }
    setLabelling(true);
    setError(null);
    try {
      const result = await generateThemeLabels(sessionId, questionId);
      if (result) setLabels(result);
      else setError("Couldn't reach the AI provider, try again in a moment.");
    } catch {
      setError("Couldn't reach the AI provider, try again in a moment.");
    } finally {
      setLabelling(false);
    }
  }

  async function handleFindMisconception() {
    setFindingMisconception(true);
    setError(null);
    try {
      const result = await generateMisconception(sessionId, questionId);
      if (result) setMisconception(result);
      else setError("Nothing conclusive found in these responses yet.");
    } catch {
      setError("Couldn't reach the AI provider, try again in a moment.");
    } finally {
      setFindingMisconception(false);
    }
  }

  return (
    <Section title="Themes">
      <ul className="flex flex-col gap-2">
        {clusters.map((c, i) => (
          <li key={i} className="flex flex-col gap-0.5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="text-stage-foreground">{labels?.[c.exemplar] ?? c.exemplar}</span>
              <span className="shrink-0 text-stage-foreground-muted">{c.count}</span>
            </div>
            {labels?.[c.exemplar] && <span className="text-xs text-stage-foreground-muted">e.g. “{c.exemplar}”</span>}
          </li>
        ))}
      </ul>

      {outliers.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stage-foreground-muted">
            Worth reading aloud
          </h4>
          {outliers.map((o, i) => (
            <p key={i} className="rounded-lg bg-stage-bg px-3 py-2 text-sm text-stage-foreground">
              “{o.text}”
            </p>
          ))}
        </div>
      )}

      {aiEnabled && (
        <div className="flex flex-col gap-2 border-t border-stage-border pt-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={labelling} onClick={handleLabelThemes}>
              {labelling ? "Labelling…" : "✨ Label themes"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={findingMisconception}
              onClick={handleFindMisconception}
            >
              {findingMisconception ? "Thinking…" : "✨ Find misconceptions"}
            </Button>
          </div>
          {misconception && (
            <div className="rounded-lg bg-stage-bg px-3 py-2 text-sm">
              <p className="text-stage-foreground">{misconception.misconception}</p>
              <p className="mt-1 text-stage-foreground-muted">Try asking: “{misconception.followUpQuestion}”</p>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-stage-border pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stage-foreground-muted">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stage-foreground-muted">{label}</span>
      <span className="font-medium text-stage-foreground">{value}</span>
    </div>
  );
}
