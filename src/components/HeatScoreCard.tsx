"use client";

import { useHavenStore } from "@/store/useHavenStore";
import type { RiskBand } from "@/types";

const BAND_TEXT_CLASS: Record<RiskBand, string> = {
  green: "text-band-green",
  yellow: "text-band-yellow",
  orange: "text-band-orange",
  red: "text-band-red",
};

const BAND_LABEL: Record<RiskBand, string> = {
  green: "Low",
  yellow: "Moderate",
  orange: "High",
  red: "Severe",
};

// Factor bars are scaled against this notional cap so the heaviest individual
// modifiers (age 65+, outdoor work at +12) read close to full and lighter ones
// (mobility +5) read clearly shorter — purely visual rhythm, not the score itself.
const FACTOR_BAR_CAP = 20;

export default function HeatScoreCard() {
  const heatScore = useHavenStore((s) => s.heatScore);
  const activeHazard = useHavenStore((s) => s.activeHazard);

  if (!heatScore || activeHazard !== "heat") return null;

  const bandColor = BAND_TEXT_CLASS[heatScore.band];
  const bandLabel = BAND_LABEL[heatScore.band];

  return (
    <div className="pointer-events-auto rounded-xl border border-haven-hairline bg-haven-surface/80 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-baseline gap-3">
          <span
            className={`text-5xl font-semibold tracking-tight tabular-nums ${bandColor}`}
          >
            {heatScore.score}
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground/70">
            / 100
          </span>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          <span className={`font-medium ${bandColor}`}>{bandLabel}</span>{" "}
          heat risk · feels like {Math.round(heatScore.feelsLikeF)}°F
        </p>

        <ul className="mt-4 space-y-2 border-t border-haven-hairline pt-3">
          {heatScore.factors.map((f, i) => {
            const widthPct = Math.min(
              100,
              (Math.abs(f.points) / FACTOR_BAR_CAP) * 100,
            );
            return (
              <li key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-foreground/85">{f.label}</span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    +{f.points}
                  </span>
                </div>
                <div className="h-0.5 rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-foreground/40"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
    </div>
  );
}
