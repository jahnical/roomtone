"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEQUENTIAL_BLUE } from "@/lib/viz/palette";

export interface BarDatum {
  label: string;
  count: number;
}

/**
 * Magnitude comparison across labeled categories (multiple-choice option
 * counts, scale-value distribution) — per the dataviz skill's form table,
 * "compare magnitude" gets a *sequential single hue*, not a categorical
 * color per bar. These aren't distinct named series being compared against
 * each other; they're one measure (response count) across categories.
 */
export function StageBarChart({ data, mode = "dark" }: { data: BarDatum[]; mode?: "light" | "dark" }) {
  const barColor = SEQUENTIAL_BLUE[mode === "dark" ? 400 : 450];
  const gridColor = mode === "dark" ? "#1c3a5e" : "#e1e0d9";
  const inkColor = mode === "dark" ? "#eaf2ff" : "#0b0b0b";
  const mutedColor = mode === "dark" ? "#93aecb" : "#898781";

  if (data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-full items-center justify-center text-stage-foreground-muted">Waiting for answers…</div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="0" />
        <XAxis
          dataKey="label"
          tick={{ fill: mutedColor, fontSize: 16 }}
          axisLine={{ stroke: gridColor }}
          tickLine={false}
        />
        <YAxis hide allowDecimals={false} />
        <Tooltip
          cursor={{ fill: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
          contentStyle={{
            background: mode === "dark" ? "#0e2340" : "#ffffff",
            border: `1px solid ${gridColor}`,
            borderRadius: 8,
            color: inkColor,
            fontSize: 14,
          }}
          formatter={(value) => `${value} response${value === 1 ? "" : "s"}`}
          labelFormatter={() => ""}
        />
        <Bar dataKey="count" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" fill={inkColor} fontSize={18} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
