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

export type ScoreFactor = { label: string; points: number };

export type HeatScoreResult = {
  score: number; // 0-100, integer
  band: RiskBand;
  environmentalBase: number; // temp-derived contribution (pre-alert bumps)
  factors: ScoreFactor[]; // explainable breakdown, in display order
  feelsLikeF: number; // the feels-like the score was computed against
};
