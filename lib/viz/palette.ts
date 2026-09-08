/**
 * Data-visualization palette — the single source of truth for chart colors
 * across recharts and the hand-rolled word cloud.
 *
 * These are the `dataviz` skill's reference categorical/sequential/status
 * values, validated with `scripts/validate_palette.js` against Roomtone's
 * *actual* two surfaces rather than the skill's neutral defaults:
 *   - light surface `#ffffff` (console, participant phone)
 *   - dark surface  `#08172a` (the presenter Stage — see app/globals.css)
 * Both passed every hard gate (lightness band, chroma floor, CVD ΔE ≥ 8,
 * normal-vision ΔE ≥ 15). On light, three slots (aqua, yellow, magenta) sit
 * below 3:1 contrast — per the skill's relief rule, always pair those with
 * a visible direct label, never color alone.
 *
 * Chrome (ink, borders, gridlines) intentionally does NOT live here — it
 * comes from the CSS custom properties in app/globals.css (--foreground,
 * --border, --stage-foreground-muted, etc.) via Tailwind utility classes,
 * so charts inherit the same navy-tinted chrome as the rest of the app
 * instead of the skill's neutral-gray defaults.
 */

export const CATEGORICAL_LIGHT = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const CATEGORICAL_DARK = [
  "#3987e5", // 1 blue
  "#d95926", // 2 orange
  "#199e70", // 3 aqua
  "#c98500", // 4 yellow
  "#d55181", // 5 magenta
  "#008300", // 6 green
  "#9085e9", // 7 violet
  "#e66767", // 8 red
] as const;

/** Slots 3, 4, and 5 (aqua/yellow/magenta) fall below 3:1 against the light surface — always pair them with a visible direct label. */
export const LIGHT_RELIEF_REQUIRED_INDICES = [2, 3, 4];

// Sequential single-hue (blue) ramp, light → dark, for magnitude encodings
// (e.g. a scale-question heatmap). Values below ordinal step 250 / above 600
// are reserved for continuous sequential use only — see palette.md.
export const SEQUENTIAL_BLUE = {
  100: "#cde2fb",
  150: "#b7d3f6",
  200: "#9ec5f4",
  250: "#86b6ef",
  300: "#6da7ec",
  350: "#5598e7",
  400: "#3987e5",
  450: "#2a78d6",
  500: "#256abf",
  550: "#1c5cab",
  600: "#184f95",
  650: "#104281",
  700: "#0d366b",
} as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export function categoricalPalette(mode: "light" | "dark"): readonly string[] {
  return mode === "dark" ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
}

/** Picks the Nth categorical color, cycling only as an explicit last resort — real charts should fold extra series into "Other" per the skill's non-negotiables. */
export function categoricalColor(index: number, mode: "light" | "dark" = "dark"): string {
  const palette = categoricalPalette(mode);
  return palette[index % palette.length];
}
