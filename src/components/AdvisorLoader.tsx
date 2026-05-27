"use client";

import { useEffect, useRef } from "react";

import { useHavenStore } from "@/store/useHavenStore";
import type { AdvisorContext, AdvisorResult } from "@/types";

// 600ms after the score stabilizes (rapid profile toggling is common in the
// demo — every flip wouldn't otherwise spam Groq). Each new render replaces
// the prior timer + aborts the prior in-flight request.
const DEBOUNCE_MS = 600;

export default function AdvisorLoader() {
  const place = useHavenStore((s) => s.place);
  const conditions = useHavenStore((s) => s.conditions);
  const heatScore = useHavenStore((s) => s.heatScore);
  const heatTrend = useHavenStore((s) => s.heatTrend);
  const profile = useHavenStore((s) => s.profile);
  const activeHazard = useHavenStore((s) => s.activeHazard);
  const setAdvisor = useHavenStore((s) => s.setAdvisor);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!place || !conditions || !heatScore || activeHazard !== "heat") {
      abortRef.current?.abort();
      setAdvisor(null);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const ctx: AdvisorContext = {
        place: { label: place.label },
        conditions: {
          tempF: conditions.tempF,
          feelsLikeF: conditions.feelsLikeF,
          alerts: conditions.alerts,
          source: conditions.source,
        },
        score: {
          score: heatScore.score,
          band: heatScore.band,
          factors: heatScore.factors,
          feelsLikeF: heatScore.feelsLikeF,
        },
        trend: heatTrend
          ? {
              perDecade: heatTrend.perDecade,
              earlyAvg: heatTrend.earlyAvg,
              recentAvg: heatTrend.recentAvg,
              direction: heatTrend.direction,
              summary: heatTrend.summary,
            }
          : null,
        profile,
      };

      try {
        const r = await fetch("/api/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ctx),
          signal: controller.signal,
        });
        if (!r.ok) return;
        const data = (await r.json()) as AdvisorResult;
        setAdvisor(data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Silent — the route always returns a safe fallback when reachable;
        // this catches only network-level failures.
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    place,
    conditions,
    heatScore,
    heatTrend,
    profile,
    activeHazard,
    setAdvisor,
  ]);

  return null;
}
