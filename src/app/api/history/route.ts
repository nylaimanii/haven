import { NextResponse } from "next/server";

import type { HistoryPoint } from "@/types";

// Open-Meteo Archive (ERA5) — free, no key, global coverage back to 1940.
// We pull daily max temperatures from 2005 through the most recent complete
// year, single-variable to keep the payload lean. Step 16 will aggregate this
// raw series into the "hot days per year" trend metric.
// TODO: cache historical responses, they're immutable per-date.

const OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const START_DATE = "2005-01-01";

type ArchiveResponse = {
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
  };
};

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function lastCompleteYearEnd(): string {
  const yr = new Date().getUTCFullYear() - 1;
  return `${yr}-12-31`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));

  if (lat == null || lng == null) {
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });
  }

  const endDate = lastCompleteYearEnd();
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: START_DATE,
    end_date: endDate,
    daily: "temperature_2m_max",
    temperature_unit: "fahrenheit",
  });

  try {
    const r = await fetch(`${OPEN_METEO_ARCHIVE}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `open-meteo archive ${r.status}`, daily: [], lat, lng },
        { status: 502 },
      );
    }
    const j = (await r.json()) as ArchiveResponse;
    const times = j.daily?.time ?? [];
    const temps = j.daily?.temperature_2m_max ?? [];

    const daily: HistoryPoint[] = [];
    const n = Math.min(times.length, temps.length);
    for (let i = 0; i < n; i++) {
      const t = temps[i];
      if (typeof t === "number") {
        daily.push({ date: times[i], tmaxF: t });
      }
    }

    return NextResponse.json({ daily, lat, lng });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "history fetch failed",
        daily: [],
        lat,
        lng,
      },
      { status: 502 },
    );
  }
}
