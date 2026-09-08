import { describe, expect, it } from "vitest";
import { tokenize } from "./normalize";

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    expect(tokenize("Great Workshop!!")).toEqual(["great", "workshop"]);
  });

  it("drops common stopwords, keeping only meaningful terms", () => {
    expect(tokenize("this is the workshop that I really loved")).toEqual(["workshop", "loved"]);
  });

  it("folds accented characters to plain ASCII", () => {
    expect(tokenize("café résumé")).toEqual(["cafe", "resume"]);
  });

  it("preserves internal hyphens and apostrophes", () => {
    expect(tokenize("state-of-the-art, don't you think?")).toEqual(["state-of-the-art", "don't", "think"]);
  });

  it("drops single-letter tokens", () => {
    expect(tokenize("a b workshop c")).toEqual(["workshop"]);
  });

  it("returns an empty array for stopword-only or empty input", () => {
    expect(tokenize("the a an is are")).toEqual([]);
    expect(tokenize("")).toEqual([]);
  });
});
