import type { RawResponseRow } from "./raw";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const HEADER = ["Participant #", "Question #", "Question", "Type", "Response", "Submitted at"];

export function buildResponsesCsv(rows: RawResponseRow[]): string {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        String(r.participantNumber),
        String(r.questionOrder),
        r.questionPrompt,
        r.questionType,
        r.value,
        r.createdAt,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  // CRLF is the CSV-spec line ending and what Excel expects; plain \n mostly
  // works too but CRLF avoids edge cases in stricter parsers.
  return lines.join("\r\n");
}
