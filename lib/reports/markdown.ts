import type { SessionReportData } from "./data";
import { QUESTION_TYPE_LABELS } from "@/lib/validation/deck";

export function buildReportMarkdown(data: SessionReportData): string {
  const lines: string[] = [];

  lines.push(`# ${data.deckTitle}`);
  lines.push("");
  lines.push(`Session code: \`${data.code}\`  `);
  lines.push(`Participants: ${data.participantCount}  `);
  lines.push(`State: ${data.state}`);
  lines.push("");

  for (const q of data.questions) {
    lines.push(`## Q${q.order + 1}. ${q.prompt}`);
    lines.push("");
    lines.push(`_${QUESTION_TYPE_LABELS[q.type]}_`);
    lines.push("");
    lines.push(q.insight.narration);
    lines.push("");

    if (q.type === "MULTIPLE_CHOICE" && q.aggregate?.type === "MULTIPLE_CHOICE") {
      for (const o of q.aggregate.options) lines.push(`- ${o.label}: ${o.count}`);
      lines.push("");
    }

    if (q.type === "SCALE" && q.aggregate?.type === "SCALE") {
      for (const c of q.aggregate.counts) lines.push(`- ${c.value}: ${c.count}`);
      lines.push("");
    }

    if (q.type === "WORD_CLOUD" && q.aggregate?.type === "WORD_CLOUD") {
      lines.push(q.aggregate.words.slice(0, 20).map((w) => `${w.text} (${w.count})`).join(", "));
      lines.push("");
    }

    if (q.type === "OPEN_TEXT" && q.insight.clusters) {
      for (const c of q.insight.clusters) lines.push(`- ${c.exemplar} (${c.count})`);
      lines.push("");
    }

    if (q.pairing && q.pairing.kind !== "unavailable" && q.pairing.shift.n > 0) {
      lines.push(`**Movement** (${q.pairing.shift.n} answered both):`);
      if (q.pairing.kind === "MULTIPLE_CHOICE") {
        for (const t of q.pairing.shift.transitions.filter((t) => t.from !== t.to)) {
          lines.push(`- ${t.count} moved ${t.from} → ${t.to}`);
        }
      } else {
        lines.push(
          `- Average moved from ${q.pairing.shift.meanBefore?.toFixed(1)} to ${q.pairing.shift.meanAfter?.toFixed(1)}`,
        );
      }
      lines.push("");
    }
  }

  if (data.qnaItems.length > 0) {
    lines.push(`## Q&A (${data.qnaItems.length})`);
    lines.push("");
    for (const item of data.qnaItems) {
      lines.push(`- [${item.answered ? "x" : " "}] ${item.text} (${item.upvotes} upvotes)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
