import { describe, expect, it } from "vitest";
import { buildResponsesCsv } from "./csv";
import type { RawResponseRow } from "./raw";

function row(overrides: Partial<RawResponseRow>): RawResponseRow {
  return {
    participantNumber: 1,
    questionOrder: 1,
    questionPrompt: "Which topic?",
    questionType: "MULTIPLE_CHOICE",
    value: "React",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildResponsesCsv", () => {
  it("includes a header row and one row per response", () => {
    const csv = buildResponsesCsv([row({}), row({ participantNumber: 2, value: "Svelte" })]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Participant #,Question #,Question,Type,Response,Submitted at");
    expect(lines).toHaveLength(3);
  });

  it("quotes and escapes values containing commas", () => {
    const csv = buildResponsesCsv([row({ value: "React, but also Svelte" })]);
    expect(csv).toContain('"React, but also Svelte"');
  });

  it("escapes embedded double quotes by doubling them", () => {
    const csv = buildResponsesCsv([row({ value: 'They said "great job"' })]);
    expect(csv).toContain('"They said ""great job"""');
  });

  it("quotes values containing newlines", () => {
    const csv = buildResponsesCsv([row({ value: "line one\nline two" })]);
    expect(csv).toContain('"line one\nline two"');
  });

  it("leaves plain values unquoted", () => {
    const csv = buildResponsesCsv([row({ value: "React" })]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe("1,1,Which topic?,MULTIPLE_CHOICE,React,2026-01-01T00:00:00.000Z");
  });
});
