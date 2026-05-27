"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { HeatTrendResult } from "@/types";

const HEAT_BAR = "#E85F36"; // --haven-heat (dark theme value)
const MA_LINE = "rgba(255,255,255,0.9)";
const GRID = "rgba(255,255,255,0.06)";
const AXIS_TEXT = "rgba(255,255,255,0.45)";

const MA_WINDOW = 5;

type Row = { year: number; hotDays: number; ma: number | null };

function buildChartData(trend: HeatTrendResult): Row[] {
  const arr = trend.perYear;
  return arr.map((p, i) => {
    if (i < MA_WINDOW - 1) {
      return { year: p.year, hotDays: p.hotDays, ma: null };
    }
    const window = arr.slice(i - (MA_WINDOW - 1), i + 1);
    const sum = window.reduce((s, x) => s + x.hotDays, 0);
    return {
      year: p.year,
      hotDays: p.hotDays,
      ma: Math.round((sum / MA_WINDOW) * 10) / 10,
    };
  });
}

export default function TrendChart({ trend }: { trend: HeatTrendResult }) {
  const data = buildChartData(trend);
  const span = data.length;
  // Label roughly every 4 years on the X-axis so ticks don't crowd.
  const tickInterval = span > 16 ? 3 : span > 10 ? 2 : 1;

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">
        Dangerous-heat days per year (≥{trend.threshold}°F)
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {trend.summary}
      </p>

      <div className="mt-5 h-72 w-full">
        {/*
          minWidth/minHeight give recharts a non-zero floor on its very first
          measurement pass — before the ResizeObserver fires with the real
          container dimensions. Without these, recharts logs "width(-1)/
          height(-1)" warnings when the chart mounts inside a panel that has
          just animated in.
        */}
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={320}
          minHeight={240}
        >
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="year"
              stroke={AXIS_TEXT}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={tickInterval}
            />
            <YAxis
              stroke={AXIS_TEXT}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              domain={[0, "dataMax + 5"]}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "rgba(20,20,25,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.9)" }}
              itemStyle={{ color: "rgba(255,255,255,0.85)" }}
              formatter={(value, name) => {
                const display =
                  typeof value === "number" ? `${value} days` : String(value ?? "");
                if (name === "hotDays") return [display, "Hot days"];
                if (name === "ma") return [display, "5-yr avg"];
                return [display, String(name)];
              }}
            />
            <Bar
              dataKey="hotDays"
              fill={HEAT_BAR}
              fillOpacity={0.75}
              radius={[2, 2, 0, 0]}
            />
            <Line
              dataKey="ma"
              type="monotone"
              stroke={MA_LINE}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-3 rounded-sm"
            style={{ background: HEAT_BAR, opacity: 0.75 }}
          />
          Hot days that year
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-[2px] w-4 rounded"
            style={{ background: MA_LINE }}
          />
          5-year moving average
        </span>
      </div>
    </div>
  );
}
