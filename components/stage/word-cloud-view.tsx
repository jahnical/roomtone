"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { layoutWordCloud, type WordInput } from "@/lib/viz/wordcloud";
import { categoricalColor } from "@/lib/viz/palette";

/**
 * Renders lib/viz/wordcloud.ts's layout as absolutely-positioned spans.
 * Color cycles through the validated categorical palette per word — a
 * deliberate exception to the "color follows the entity" rule elsewhere in
 * this app: a word cloud isn't comparing named series, the color is doing
 * visual rhythm, not identity, so cycling through 8 brand-validated hues
 * (never an arbitrary rainbow) is the right call here specifically.
 */
export function WordCloudView({ words, mode = "dark" }: { words: WordInput[]; mode?: "light" | "dark" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Measure synchronously on mount rather than waiting for the first
    // ResizeObserver callback — that first callback can lag a frame behind
    // mount, which would otherwise show "Waiting for answers…" flash before
    // snapping to the real layout. The observer below still handles any
    // later resize (window resize, sidebar toggle, etc.).
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!size || size.width === 0 || size.height === 0 || words.length === 0) return null;
    return layoutWordCloud(words, size.width, size.height);
  }, [words, size]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {layout ? (
        <div className="absolute inset-0" style={{ transform: "translate(50%, 50%)" }}>
          {layout.words.map((w) => (
            <span
              key={w.text}
              className="absolute whitespace-nowrap font-semibold leading-none"
              style={{
                left: w.x,
                top: w.y,
                fontSize: w.fontSize,
                color: categoricalColor(w.colorIndex, mode),
                transform: "translate(-50%, -50%)",
              }}
            >
              {w.text}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-stage-foreground-muted">
          {words.length === 0 ? "Waiting for answers…" : ""}
        </div>
      )}
    </div>
  );
}
