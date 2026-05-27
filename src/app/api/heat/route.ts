import { NextResponse } from "next/server";

// Open-Meteo current air temperature, batched in ONE request via comma-separated
// lat/lng. This approximates a heat field for the MVP. The free tier needs no key.
// TODO: swap to real land-surface-temperature (e.g. NASA MODIS / Landsat LST) later.

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const GRID_N = 9; // 9x9 = 81 points, single batched request, comfortably under limits
const DEFAULT_RADIUS_DEG = 0.075; // ~0.15° box (~16km) for center-based queries

export type HeatPoint = { lat: number; lng: number; temp: number };

type OpenMeteoPoint = {
  latitude: number;
  longitude: number;
  current?: { temperature_2m?: number };
};

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

  const params = new URLSearchParams({
    latitude: lats.join(","),
    longitude: lngs.join(","),
    current: "temperature_2m",
  });

  try {
    const r = await fetch(`${OPEN_METEO}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `open-meteo ${r.status}`, points: [] },
        { status: 502 },
      );
    }
    const raw = (await r.json()) as OpenMeteoPoint | OpenMeteoPoint[];
    const items = Array.isArray(raw) ? raw : [raw];

    const points: HeatPoint[] = [];
    for (const it of items) {
      const t = it.current?.temperature_2m;
      if (typeof t === "number") {
        points.push({ lat: it.latitude, lng: it.longitude, temp: t });
      }
    }

    return NextResponse.json({ points });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "heat fetch failed", points: [] },
      { status: 502 },
    );
  }
}
