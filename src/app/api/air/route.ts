import { NextResponse } from "next/server";

import { fetchWithRetry } from "@/lib/fetchWithRetry";

// Real-time US AQI for the current viewport via Open-Meteo's free Air Quality
// API (no key). This is genuine current air-quality data — wildfire smoke,
// urban pollution, and inversion events all show up. Not a proxy.
// We chunk to ≤100 coords/request like /api/flood (Open-Meteo's coordinate
// cap on these endpoints).

const OPEN_METEO_AQ = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GRID_N = 16;
const DEFAULT_RADIUS_DEG = 0.075;
const AQ_CHUNK = 100;

export type AirPoint = { lat: number; lng: number; aqi: number };

type AirCurrentResponse = {
  current?: { us_aqi?: number };
};

// Open-Meteo returns an array for batched lat/lng, a single object otherwise.
type AirBatchResponse = AirCurrentResponse | AirCurrentResponse[];

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const west = num(searchParams.get("west"));
  const south = num(searchParams.get("south"));
  const east = num(searchParams.get("east"));
  const north = num(searchParams.get("north"));
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));

  let bbox: { west: number; south: number; east: number; north: number };
  if (west != null && south != null && east != null && north != null) {
    bbox = { west, south, east, north };
  } else if (lat != null && lng != null) {
    bbox = {
      west: lng - DEFAULT_RADIUS_DEG,
      east: lng + DEFAULT_RADIUS_DEG,
      south: lat - DEFAULT_RADIUS_DEG,
      north: lat + DEFAULT_RADIUS_DEG,
    };
  } else {
    return NextResponse.json(
      { error: "missing bounds (west/south/east/north) or center (lat/lng)" },
      { status: 400 },
    );
  }

  const lats: number[] = [];
  const lngs: number[] = [];
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const a = bbox.south + ((bbox.north - bbox.south) * i) / (GRID_N - 1);
      const o = bbox.west + ((bbox.east - bbox.west) * j) / (GRID_N - 1);
      lats.push(Number(a.toFixed(4)));
      lngs.push(Number(o.toFixed(4)));
    }
  }

  try {
    const aqis: (number | null)[] = [];
    for (let start = 0; start < lats.length; start += AQ_CHUNK) {
      const end = Math.min(start + AQ_CHUNK, lats.length);
      const params = new URLSearchParams({
        latitude: lats.slice(start, end).join(","),
        longitude: lngs.slice(start, end).join(","),
        current: "us_aqi",
      });
      const r = await fetchWithRetry(`${OPEN_METEO_AQ}?${params.toString()}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        return NextResponse.json(
          { error: `open-meteo air-quality ${r.status}`, points: [] },
          { status: 502 },
        );
      }
      const raw = (await r.json()) as AirBatchResponse;
      const items = Array.isArray(raw) ? raw : [raw];
      for (const it of items) {
        const v = it.current?.us_aqi;
        aqis.push(typeof v === "number" ? v : null);
      }
    }

    if (aqis.length !== lats.length) {
      return NextResponse.json(
        { error: "aqi count mismatch", points: [] },
        { status: 502 },
      );
    }

    const points: AirPoint[] = [];
    for (let i = 0; i < lats.length; i++) {
      const v = aqis[i];
      if (typeof v === "number") {
        points.push({ lat: lats[i], lng: lngs[i], aqi: v });
      }
    }
    return NextResponse.json({ points });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "aqi fetch failed",
        points: [],
      },
      { status: 502 },
    );
  }
}
