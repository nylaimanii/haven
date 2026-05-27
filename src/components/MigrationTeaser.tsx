"use client";

import { Compass, Sparkles } from "lucide-react";

import type { HeatTrendResult } from "@/types";

// Honest forward-looking teaser for the migration / receiving-regions concept.
// We are NOT computing a personalized match for the user's place — that would
// require capacity, water, jobs, housing, and combined-climate-resilience data
// we don't yet have. The archetypes below are illustrative examples of *what
// kind of place* the v2 matcher might surface; they are clearly labeled as such.
//
// TODO: real receiving-region matching engine (capacity, water, jobs, climate
//       resilience data).

type Props = { trend: HeatTrendResult };

const EXAMPLE_REGIONS: { name: string; summary: string }[] = [
  {
    name: "Great Lakes region",
    summary: "Abundant freshwater, lower extreme-heat exposure.",
  },
  {
    name: "Pacific Northwest interior",
    summary: "Cooler summer baseline, established water infrastructure.",
  },
  {
    name: "Northern Appalachia",
    summary: "Moderate climate, lower combined wildfire / flood exposure.",
  },
];

function leadInFor(trend: HeatTrendResult): string {
  if (trend.direction === "rising") {
    return "Your area is trending warmer over time. For places on a rising long-term trajectory, longer-horizon adaptation can include considering more climate-resilient regions.";
  }
  if (trend.direction === "falling") {
    return "Your area's heat trajectory is actually trending downward — local adaptation may be the main lever here.";
  }
  return "Your area is roughly steady right now. Even for steady places, HAVEN is exploring how to surface longer-horizon options if the trajectory shifts.";
}

export default function MigrationTeaser({ trend }: Props) {
  const leadIn = leadInFor(trend);

  return (
    <section className="mt-10 rounded-xl border border-haven-hairline bg-haven-surface/60 p-5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70">
        <Sparkles className="size-3" aria-hidden />
        <span>Looking further ahead · exploring</span>
      </div>
      <h3 className="mt-2 text-sm font-medium text-foreground">
        Where might people go if a place’s trajectory becomes severe?
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {leadIn}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        HAVEN is exploring a matcher that would pair people in
        high-trajectory areas to <em>receiving regions</em> — places with
        stronger freshwater, lower combined hazard exposure, and capacity to
        grow. This is a forward-looking concept, not a built feature; the
        examples below are illustrative archetypes, not personalized
        recommendations.
      </p>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Illustrative archetypes
        </p>
        <ul className="mt-2 space-y-1.5">
          {EXAMPLE_REGIONS.map((r) => (
            <li
              key={r.name}
              className="flex items-start gap-2 text-xs text-foreground/90"
            >
              <Compass
                className="mt-0.5 size-3.5 shrink-0 text-haven-safe"
                aria-hidden
              />
              <span>
                <span className="font-medium">{r.name}</span>{" "}
                <span className="text-muted-foreground">— {r.summary}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
