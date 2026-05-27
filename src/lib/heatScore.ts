/**
 * Deterministic 0-100 heat risk score.
 *
 * Pure function of (conditions, profile). No randomness, no time, no AI.
 * Same inputs MUST always produce the same number — this is the "ATS-style"
 * code-driven scoring that the AI advisor (later) explains rather than invents.
 *
 * The score combines two layers:
 *   1. ENVIRONMENTAL base — feels-like temperature mapped to NWS Heat Index
 *      categories, plus any active heat alerts.
 *   2. PERSONAL modifiers — additive contributions from the vulnerability
 *      profile (age, conditions, AC access, outdoor exposure).
 *
 * The returned `factors` array is the canonical "why" breakdown the UI and the
 * AI explanation will both consume.
 */

import type {
  Conditions,
  HeatScoreResult,
  Profile,
  RiskBand,
  ScoreFactor,
} from "@/types";

// --- Bands ------------------------------------------------------------------

export const BAND_RANGES: Record<RiskBand, { min: number; max: number }> = {
  green: { min: 0, max: 24 },
  yellow: { min: 25, max: 49 },
  orange: { min: 50, max: 74 },
  red: { min: 75, max: 100 },
};

export function bandForScore(score: number): RiskBand {
  if (score >= 75) return "red";
  if (score >= 50) return "orange";
  if (score >= 25) return "yellow";
  return "green";
}

// --- Environmental base -----------------------------------------------------

/**
 * Map feels-like °F to a 0-100 base. Bands align with NWS Heat Index Chart:
 *   <70°F: no meaningful heat risk → 0
 *   70-80: ramp 0 → 20 (warm)
 *   80-90: ramp 20 → 45 (caution)
 *   90-103: ramp 45 → 70 (extreme caution)
 *   103-125: ramp 70 → 90 (danger)
 *   125+:   ramp 90 → 100 (extreme danger)
 */
function environmentalBaseFromFeelsLike(feelsF: number): number {
  if (feelsF <= 70) return 0;
  if (feelsF < 80) return Math.round(((feelsF - 70) / 10) * 20);
  if (feelsF < 90) return Math.round(20 + ((feelsF - 80) / 10) * 25);
  if (feelsF < 103) return Math.round(45 + ((feelsF - 90) / 13) * 25);
  if (feelsF < 125) return Math.round(70 + ((feelsF - 103) / 22) * 20);
  return Math.min(100, Math.round(90 + ((feelsF - 125) / 25) * 10));
}

// --- Alerts -----------------------------------------------------------------

function alertBumpAndLabel(
  alerts: Conditions["alerts"],
): { points: number; label: string } | null {
  // Pick the strongest active alert; don't double-count overlapping ones.
  let best: { points: number; label: string } | null = null;
  for (const a of alerts) {
    const ev = a.event.toLowerCase();
    if (ev.includes("excessive heat warning")) {
      const candidate = { points: 15, label: "Excessive Heat Warning active" };
      if (!best || candidate.points > best.points) best = candidate;
    } else if (ev.includes("heat advisory")) {
      const candidate = { points: 8, label: "Heat Advisory active" };
      if (!best || candidate.points > best.points) best = candidate;
    } else if (ev.includes("heat watch")) {
      const candidate = { points: 5, label: "Heat Watch active" };
      if (!best || candidate.points > best.points) best = candidate;
    }
  }
  return best;
}

// --- Personal modifiers -----------------------------------------------------

const AGE_POINTS: Record<Profile["ageBand"], number> = {
  under18: 6,
  "18to64": 0,
  "65plus": 12,
};

const AGE_LABEL: Record<Profile["ageBand"], string> = {
  under18: "Under 18",
  "18to64": "",
  "65plus": "Age 65+",
};

const CONDITION_POINTS: Record<string, number> = {
  heart_condition: 10,
  respiratory: 8,
  pregnant: 6,
  mobility: 5,
};

const CONDITION_LABEL: Record<string, string> = {
  heart_condition: "Heart condition",
  respiratory: "Respiratory condition",
  pregnant: "Pregnant",
  mobility: "Mobility limited",
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

// --- Main -------------------------------------------------------------------

export function computeHeatScore(
  conditions: Conditions,
  profile: Profile,
): HeatScoreResult {
  const feelsLikeF =
    typeof conditions.feelsLikeF === "number"
      ? conditions.feelsLikeF
      : conditions.tempF;

  const environmentalBase = environmentalBaseFromFeelsLike(feelsLikeF);
  const factors: ScoreFactor[] = [
    { label: `Feels like ${Math.round(feelsLikeF)}°F`, points: environmentalBase },
  ];

  const alert = alertBumpAndLabel(conditions.alerts);
  if (alert) factors.push({ label: alert.label, points: alert.points });

  // TODO: factor in conditions.heatRiskLevel once NWS HeatRisk is wired (step 12 left it null).

  const agePts = AGE_POINTS[profile.ageBand];
  if (agePts > 0) {
    factors.push({ label: AGE_LABEL[profile.ageBand], points: agePts });
  }

  for (const id of profile.conditions) {
    const pts = CONDITION_POINTS[id];
    if (pts && CONDITION_LABEL[id]) {
      factors.push({ label: CONDITION_LABEL[id], points: pts });
    }
  }

  if (!profile.hasAC) {
    factors.push({ label: "No air conditioning at home", points: 10 });
  }
  if (profile.outdoorWorker) {
    factors.push({ label: "Outdoor work/activity", points: 12 });
  }

  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  const score = clamp(Math.round(raw), 0, 100);

  return {
    score,
    band: bandForScore(score),
    environmentalBase,
    factors,
    feelsLikeF,
  };
}
