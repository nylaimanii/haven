"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  Clock,
  Droplet,
  Heart,
  Home,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useHavenStore } from "@/store/useHavenStore";

// Pick a small icon for each action based on simple keyword matches. The
// LLM returns freeform action strings, so we infer intent rather than
// requiring a structured response.
function iconForAction(action: string): LucideIcon {
  const t = action.toLowerCase();
  if (/hydrat|water|drink|fluid/.test(t)) return Droplet;
  if (/emergency|911|chest pain|fainting|confusion/.test(t)) return AlertCircle;
  if (/check|neighbor|loved|alone|family/.test(t)) return Heart;
  if (/cool|shade|ac\b|air ?condition|indoor|inside|library|mall/.test(t)) return Home;
  if (/break|rest|early|morning|evening|schedul|noon|afternoon|peak|hour|midday|reschedul/.test(t)) return Clock;
  return Check;
}

function iconForTrend(direction: string | undefined): LucideIcon {
  if (direction === "rising") return TrendingUp;
  if (direction === "falling") return TrendingDown;
  return Minus;
}

function Skeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="h-4 w-3/4 rounded bg-foreground/10" />
      <div className="mt-3 h-3 w-full rounded bg-foreground/10" />
      <div className="mt-1.5 h-3 w-5/6 rounded bg-foreground/10" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-foreground/10" />
        <div className="h-3 w-11/12 rounded bg-foreground/10" />
        <div className="h-3 w-4/5 rounded bg-foreground/10" />
      </div>
      <div className="mt-4 border-t border-haven-hairline pt-3">
        <div className="h-3 w-3/4 rounded bg-foreground/10" />
      </div>
    </div>
  );
}

export default function AdvisorCard() {
  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);
  const heatScore = useHavenStore((s) => s.heatScore);
  const heatTrend = useHavenStore((s) => s.heatTrend);
  const advisor = useHavenStore((s) => s.advisor);

  // The advisor card is paired with the score card — show whenever the score
  // shows, even if the advisor itself is still in flight (loading skeleton).
  if (!place || activeHazard !== "heat" || !heatScore) return null;

  const TrendIcon = iconForTrend(heatTrend?.direction);

  return (
    <div className="pointer-events-auto rounded-xl border border-haven-hairline bg-haven-surface/80 p-5 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70">
        <Sparkles className="size-3" aria-hidden />
        <span>HAVEN advisor</span>
      </div>

      {!advisor ? (
        <Skeleton />
      ) : (
        <>
          <h3 className="text-sm font-medium leading-snug text-foreground">
            {advisor.headline}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {advisor.why}
          </p>

          <ul className="mt-4 space-y-2.5">
            {advisor.actions.map((action, i) => {
              const Icon = iconForAction(action);
              return (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs leading-relaxed text-foreground/90"
                >
                  <Icon
                    className="mt-0.5 size-3.5 shrink-0 text-haven-heat"
                    aria-hidden
                  />
                  <span>{action}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-start gap-2.5 border-t border-haven-hairline pt-3 text-xs leading-relaxed text-muted-foreground">
            <TrendIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{advisor.trendNote}</span>
          </div>
        </>
      )}
    </div>
  );
}
