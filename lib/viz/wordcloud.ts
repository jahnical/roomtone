/**
 * Deterministic word cloud layout — Archimedean-spiral placement with
 * rectangle-collision detection, hand-rolled instead of pulling in d3-cloud.
 *
 * Two things that matter for a presenter tool specifically:
 *  - Deterministic: the same set of answers always produces the same
 *    picture. A re-presented deck (or a page reload mid-session) shouldn't
 *    make the word cloud visibly jump around, which random-start-angle
 *    implementations do.
 *  - All-horizontal text: classic word clouds rotate some words 90° for
 *    visual interest, but this is read off a projector by a whole room —
 *    sideways text is a legibility tax with no offsetting benefit here.
 *
 * Runs client-side only: it needs a Canvas 2D context for text measurement.
 */

export interface WordInput {
  text: string;
  count: number;
}

export interface PlacedWord extends WordInput {
  x: number; // center x, in layout units
  y: number; // center y, in layout units
  fontSize: number;
  width: number;
  height: number;
  colorIndex: number;
}

export interface WordCloudLayout {
  words: PlacedWord[];
  width: number;
  height: number;
}

const MIN_FONT = 14;
const MAX_FONT = 72;
// Linear Archimedean spiral: radius grows by RADIUS_STEP every attempt,
// angle by ANGLE_STEP — both independent of the current radius. An earlier
// version scaled both by 1/radius (a common approximation for constant
// arc-length sampling), but clamped near the origin that made the first
// several dozen attempts crawl outward by fractions of a pixel per step,
// so large early words (which get first pick of the center) never
// actually escaped each other's bounding boxes within MAX_ATTEMPTS —
// visible as heavy overlap in testing. Plain linear growth reaches a
// useful radius within a couple dozen attempts and is simple enough to
// reason about directly.
const ANGLE_STEP = 0.22; // radians per attempt (~29 attempts per revolution)
const RADIUS_STEP = 2.4; // px per attempt
const WORD_PADDING = 4; // px gap enforced between placed words' bounding boxes
const MAX_ATTEMPTS = 1200; // spiral samples per word before giving up and placing it at the edge anyway

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable — word cloud requires a browser environment.");
    measureCtx = ctx;
  }
  return measureCtx;
}

let cachedFontFamily: string | null = null;
/**
 * Canvas `ctx.font` strings are parsed with a restricted CSS font shorthand
 * grammar that does NOT support `var(...)` — passing a custom property
 * there is silently invalid and the context falls back to its default
 * font (browser-default serif, ~10px), so every measureText() call
 * returns a wildly-too-small box while the actual DOM span (a normal
 * inline style, unrelated to canvas) renders at the real size. That
 * mismatch is what produced heavy overlap: the algorithm thought words
 * were much smaller than they actually render. Reading the *computed*
 * font-family off a live DOM element resolves the CSS variable to its
 * final concrete value (Geist Sans's generated name), so canvas
 * measurement matches the real rendered font exactly.
 */
function getBodyFontFamily(): string {
  if (!cachedFontFamily) {
    cachedFontFamily = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  }
  return cachedFontFamily;
}

function fontSizeFor(count: number, maxCount: number): number {
  if (maxCount <= 0) return MIN_FONT;
  // Square-root scale: linear-by-count makes the top word overwhelm
  // everything else in a typical classroom-sized response set (n < 100).
  const t = Math.sqrt(count / maxCount);
  return Math.round(MIN_FONT + t * (MAX_FONT - MIN_FONT));
}

function measure(ctx: CanvasRenderingContext2D, text: string, fontSize: number): { width: number; height: number } {
  ctx.font = `600 ${fontSize}px ${getBodyFontFamily()}`;
  const metrics = ctx.measureText(text);
  // A small safety margin: canvas and DOM text layout can differ by a
  // pixel or two even with a matching font-family (subpixel rounding,
  // font-feature differences) — better to pack slightly looser than to
  // reintroduce a hairline overlap.
  return { width: metrics.width * 1.04, height: fontSize * 1.2 };
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width + WORD_PADDING * 2 &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height + WORD_PADDING * 2
  );
}

/**
 * Lays out `words` (any order in — internally sorted by count desc, largest
 * placed first, which is what makes spiral packing look good) into a
 * `width` × `height` box centered at the origin.
 */
export function layoutWordCloud(words: WordInput[], width: number, height: number): WordCloudLayout {
  const ctx = getMeasureContext();
  const sorted = [...words].filter((w) => w.count > 0).sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count ?? 0;

  const placed: PlacedWord[] = [];

  sorted.forEach((word, index) => {
    const fontSize = fontSizeFor(word.count, maxCount);
    const { width: w, height: h } = measure(ctx, word.text, fontSize);

    // Deterministic per-word start angle (a fixed fraction of the circle,
    // by index) rather than Math.random() — see the file doc comment.
    const startAngle = (index * 2.399963) % (Math.PI * 2); // golden-angle-ish spread, still fully deterministic
    let angle = startAngle;
    let radius = 0;
    let x = 0;
    let y = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      x = radius * Math.cos(angle);
      y = radius * Math.sin(angle);
      const candidate = { x, y, width: w, height: h };

      const withinBounds =
        x - w / 2 >= -width / 2 && x + w / 2 <= width / 2 && y - h / 2 >= -height / 2 && y + h / 2 <= height / 2;

      if (withinBounds && !placed.some((p) => rectsOverlap(candidate, p))) {
        break; // found a free spot — x/y are already set to it
      }

      angle += ANGLE_STEP;
      radius += RADIUS_STEP;
      // Ran out of attempts (a very long response list): the loop simply
      // ends and the word is placed at wherever the spiral last reached —
      // overlap in that edge case beats dropping the word entirely.
    }

    placed.push({ ...word, x, y, fontSize, width: w, height: h, colorIndex: index });
  });

  return { words: placed, width, height };
}
