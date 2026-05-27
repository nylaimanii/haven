/**
 * Deterministic heat-trend metric: how "dangerous-heat days per year" have
 * shifted at a place over the last ~20 years. Pure function of the history
 * series — no AI, no randomness, no Date(). The step-17 AI advisor can
 * elaborate on this; the numbers themselves come from here.
 *
 * A "dangerous-heat day" is a day where the daily max temperature reached the
 * NWS caution-range threshold (90°F). We group the raw daily series by year,
 * drop any year with too few records (so comparison is fair), then run a
 * simple least-squares regression on (year, hotDays) to get the trend slope.
 */

import type {
  HeatTrendResult,
  HistoryPoint,
  YearHotDays,
} from "@/types";

const THRESHOLD_F = 90;
const MIN_DAYS_PER_YEAR = 300; // anything less is incomplete (start/end of archive)
const DEADBAND_PER_YEAR = 0.1; // |slope| within this counts as "flat"
const WINDOW = 5; // years for early-vs-recent average

function meanHotDays(items: YearHotDays[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((s, p) => s + p.hotDays, 0);
  return Math.round(total / items.length);
}

function spanLabel(years: number): string {
  if (years >= 20) return "two decades";
  if (years >= 10) return "a decade";
  return `${years} years`;
}

export function computeHeatTrend(history: HistoryPoint[]): HeatTrendResult {
  // 1) Group by year, counting hot days + total days.
  const byYear = new Map<number, { hot: number; total: number }>();
  for (const p of history) {
    const yr = Number(p.date.substring(0, 4));
    if (!Number.isFinite(yr)) continue;
    const bucket = byYear.get(yr) ?? { hot: 0, total: 0 };
    bucket.total += 1;
    if (p.tmaxF >= THRESHOLD_F) bucket.hot += 1;
    byYear.set(yr, bucket);
  }

  // 2) Drop incomplete years so the comparison is honest.
  const perYear: YearHotDays[] = [];
  for (const [year, c] of byYear) {
    if (c.total >= MIN_DAYS_PER_YEAR) {
      perYear.push({ year, hotDays: c.hot });
    }
  }
  perYear.sort((a, b) => a.year - b.year);

  if (perYear.length === 0) {
    return {
      threshold: THRESHOLD_F,
      perYear: [],
      slopePerYear: 0,
      perDecade: 0,
      earlyAvg: 0,
      recentAvg: 0,
      direction: "flat",
      summary: "No complete years of history available.",
    };
  }

  // 3) Least-squares slope of hotDays vs year.
  const n = perYear.length;
  const meanX = perYear.reduce((s, p) => s + p.year, 0) / n;
  const meanY = perYear.reduce((s, p) => s + p.hotDays, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of perYear) {
    const dx = p.year - meanX;
    num += dx * (p.hotDays - meanY);
    den += dx * dx;
  }
  const slopePerYear = den === 0 ? 0 : num / den;
  const perDecade = Math.round(slopePerYear * 10);

  // 4) Early vs recent N-year averages — more stable than single endpoint years.
  const w = Math.min(WINDOW, Math.floor(n / 2)) || 1;
  const earlyAvg = meanHotDays(perYear.slice(0, w));
  const recentAvg = meanHotDays(perYear.slice(n - w));

  // 5) Direction with deadband.
  const direction: HeatTrendResult["direction"] =
    slopePerYear > DEADBAND_PER_YEAR
      ? "rising"
      : slopePerYear < -DEADBAND_PER_YEAR
        ? "falling"
        : "flat";

  // 6) Plain-language summary, built deterministically from the numbers.
  const span = perYear[n - 1].year - perYear[0].year;
  const sl = spanLabel(span);
  const dec = Math.abs(perDecade);
  let summary: string;
  if (direction === "rising") {
    summary =
      dec > 0
        ? `Now averaging ~${recentAvg} days/year above ${THRESHOLD_F}°F, up from ~${earlyAvg} ${sl} ago — about +${dec} days per decade.`
        : `Now averaging ~${recentAvg} days/year above ${THRESHOLD_F}°F, up from ~${earlyAvg} ${sl} ago.`;
  } else if (direction === "falling") {
    summary =
      dec > 0
        ? `Now averaging ~${recentAvg} days/year above ${THRESHOLD_F}°F, down from ~${earlyAvg} ${sl} ago — about −${dec} days per decade.`
        : `Now averaging ~${recentAvg} days/year above ${THRESHOLD_F}°F, down from ~${earlyAvg} ${sl} ago.`;
  } else {
    // Keep the then-vs-now numbers visible even when the regression is too
    // noisy to call a direction — year-to-year heat variation is large.
    summary = `Averaging ~${recentAvg} days/year above ${THRESHOLD_F}°F now, compared to ~${earlyAvg} ${sl} ago — overall roughly steady.`;
  }

  return {
    threshold: THRESHOLD_F,
    perYear,
    slopePerYear,
    perDecade,
    earlyAvg,
    recentAvg,
    direction,
    summary,
  };
}
