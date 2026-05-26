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
