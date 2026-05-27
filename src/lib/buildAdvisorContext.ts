import type {
  AdvisorContext,
  Conditions,
  HeatScoreResult,
  HeatTrendResult,
  Place,
  Profile,
} from "@/types";

export type AdvisorContextInput = {
  place: Place | null;
  conditions: Conditions | null;
  heatScore: HeatScoreResult | null;
  heatTrend: HeatTrendResult | null;
  profile: Profile;
};

/**
 * Assembles the lean AdvisorContext that /api/advisor consumes.
 *
 * "Lean" = only what the LLM needs to narrate the deterministic engine.
 * We deliberately strip store fields the advisor never references (raw
 * history series, activeHazard, derived score internals) to keep completions
 * focused and cheap.
 *
 * Returns null when any required piece (place, conditions, score) is missing.
 * Callers use that null as the single gate to decide whether to fire the fetch.
 */
export function buildAdvisorContext(
  input: AdvisorContextInput,
): AdvisorContext | null {
  const { place, conditions, heatScore, heatTrend, profile } = input;
  if (!place || !conditions || !heatScore) return null;

  return {
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
    profile: {
      ageBand: profile.ageBand,
      conditions: profile.conditions,
      hasAC: profile.hasAC,
      outdoorWorker: profile.outdoorWorker,
    },
  };
}
