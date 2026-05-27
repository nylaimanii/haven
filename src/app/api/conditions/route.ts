import { NextResponse } from "next/server";

import type { ConditionAlert, Conditions } from "@/types";

// Real-time point conditions for the selected place.
// Path: NWS (api.weather.gov) for US points → Open-Meteo fallback for the rest.
// NWS requires a descriptive User-Agent or it 403s — we set it server-side here.
// TODO: wire NWS HeatRisk (the 0-4 experimental product from WPC) — it's not
//       exposed via api.weather.gov yet, so heatRiskLevel stays null for now.

const NWS_BASE = "https://api.weather.gov";
const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

const NWS_HEADERS = {
  "User-Agent": "HAVEN-climate-app (github.com/nylaimanii/haven)",
  Accept: "application/geo+json",
};

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const cToF = (c: number) => (c * 9) / 5 + 32;

// Rothfusz heat-index regression. T in °F, RH in % (0..100).
// Returns T directly below ~80°F where the regression isn't meaningful.
function heatIndexF(t: number, rh: number): number {
  if (t < 80) return t;
  return (
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t * t -
    0.05481717 * rh * rh +
    0.00122874 * t * t * rh +
    0.00085282 * t * rh * rh -
    0.00000199 * t * t * rh * rh
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

type NWSPointsResponse = {
  properties?: { forecastHourly?: string };
};

type NWSHourlyPeriod = {
  startTime: string;
  temperature: number;
  temperatureUnit: string;
  relativeHumidity?: { value?: number };
};

type NWSHourlyResponse = {
  properties?: { periods?: NWSHourlyPeriod[] };
};

type NWSAlertsResponse = {
  features?: Array<{
    properties?: { event?: string; severity?: string };
  }>;
};

async function tryNWS(
  lat: number,
  lng: number,
): Promise<Conditions | null> {
  const pointsRes = await fetch(`${NWS_BASE}/points/${lat},${lng}`, {
    headers: NWS_HEADERS,
    cache: "no-store",
  });
  if (!pointsRes.ok) return null;
  const points = (await pointsRes.json()) as NWSPointsResponse;
  const hourlyUrl = points.properties?.forecastHourly;
  if (!hourlyUrl) return null;

  const hourlyRes = await fetch(hourlyUrl, {
    headers: NWS_HEADERS,
    cache: "no-store",
  });
  if (!hourlyRes.ok) return null;
  const hourly = (await hourlyRes.json()) as NWSHourlyResponse;
  const period = hourly.properties?.periods?.[0];
  if (!period || typeof period.temperature !== "number") return null;

  const tempF =
    period.temperatureUnit === "C"
      ? cToF(period.temperature)
      : period.temperature;
  const rh = period.relativeHumidity?.value;
  const feelsLikeF =
    typeof rh === "number" ? round1(heatIndexF(tempF, rh)) : null;

  let alerts: ConditionAlert[] = [];
  try {
    const alertsRes = await fetch(
      `${NWS_BASE}/alerts/active?point=${lat},${lng}`,
      { headers: NWS_HEADERS, cache: "no-store" },
    );
    if (alertsRes.ok) {
      const body = (await alertsRes.json()) as NWSAlertsResponse;
      alerts = (body.features ?? [])
        .map((f) => ({
          event: f.properties?.event ?? "",
          severity: f.properties?.severity ?? "",
        }))
        .filter((a) => a.event);
    }
  } catch {
    // alerts failure is non-fatal — we still return temp + feels-like
  }

  return {
    tempF: round1(tempF),
    feelsLikeF,
    heatRiskLevel: null,
    alerts,
    source: "nws",
    observedAt: period.startTime,
  };
}

type OpenMeteoCurrentResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
  };
};

async function tryOpenMeteo(
  lat: number,
  lng: number,
): Promise<Conditions | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,apparent_temperature",
    temperature_unit: "fahrenheit",
  });
  const r = await fetch(`${OPEN_METEO}?${params.toString()}`, {
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = (await r.json()) as OpenMeteoCurrentResponse;
  const c = j.current;
  if (!c || typeof c.temperature_2m !== "number") return null;
  return {
    tempF: round1(c.temperature_2m),
    feelsLikeF:
      typeof c.apparent_temperature === "number"
        ? round1(c.apparent_temperature)
        : null,
    heatRiskLevel: null,
    alerts: [],
    source: "open-meteo",
    observedAt: c.time ?? new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));

  if (lat == null || lng == null) {
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });
  }

  try {
    const nws = await tryNWS(lat, lng);
    if (nws) return NextResponse.json(nws);

    const om = await tryOpenMeteo(lat, lng);
    if (om) return NextResponse.json(om);

    return NextResponse.json(
      { error: "no conditions available" },
      { status: 502 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "conditions fetch failed" },
      { status: 502 },
    );
  }
}
