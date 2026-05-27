export type Hazard = "heat" | "flood" | "air";

export type RiskBand = "green" | "yellow" | "orange" | "red";

export type Place = {
  lat: number;
  lng: number;
  label: string;
};

export type AgeBand = "under18" | "18to64" | "65plus";

export type Profile = {
  ageBand: AgeBand;
  conditions: string[];
  hasAC: boolean;
  outdoorWorker: boolean;
};

export type ConditionAlert = { event: string; severity: string };

export type Conditions = {
  tempF: number;
  feelsLikeF: number | null;
  heatRiskLevel: number | null; // 0-4 (NWS HeatRisk); null when unavailable
  alerts: ConditionAlert[];
  source: "nws" | "open-meteo";
  observedAt: string; // ISO timestamp from the upstream
};

export type HistoryPoint = { date: string; tmaxF: number };

export type YearHotDays = { year: number; hotDays: number };

export type HeatTrendResult = {
  threshold: number; // °F used to define a "dangerous-heat" day
  perYear: YearHotDays[]; // sorted ascending, incomplete years dropped
  slopePerYear: number; // least-squares slope of hotDays vs year
  perDecade: number; // rounded slope * 10
  earlyAvg: number; // mean hotDays over the first 5 complete years
  recentAvg: number; // mean hotDays over the most recent 5 complete years
  direction: "rising" | "flat" | "falling"; // from slope with small deadband
  summary: string; // plain-language, deterministically built from the numbers
};

export type ScoreFactor = { label: string; points: number };

export type HeatScoreResult = {
  score: number; // 0-100, integer
  band: RiskBand;
  environmentalBase: number; // temp-derived contribution (pre-alert bumps)
  factors: ScoreFactor[]; // explainable breakdown, in display order
  feelsLikeF: number; // the feels-like the score was computed against
};
