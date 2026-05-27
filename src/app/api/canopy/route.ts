import { NextResponse } from "next/server";

import { fetchWithRetry } from "@/lib/fetchWithRetry";

// Tree-canopy / shade proxy for the MVP. We sample Open-Meteo's
// soil_moisture_0_to_1cm across the same 16x16 grid used for heat: vegetated
// pockets (parks, tree-lined blocks) retain visibly more topsoil moisture than
// asphalt/concrete, so this is a usable continuous proxy for "where there's
// shade/relief".
// TODO: swap to real NLCD / USFS tree canopy cover raster when we self-host.

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const GRID_N = 16; // must match the heat route + client buildRasterURL grid
const DEFAULT_RADIUS_DEG = 0.075;

export type CanopyPoint = { lat: number; lng: number; canopy: number };

type OpenMeteoPoint = {
  latitude: number;
  longitude: number;
  current?: { soil_moisture_0_to_1cm?: number };
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
    current: "soil_moisture_0_to_1cm",
  });

  try {
    const r = await fetchWithRetry(`${OPEN_METEO}?${params.toString()}`, {
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

    const points: CanopyPoint[] = [];
    for (const it of items) {
      const m = it.current?.soil_moisture_0_to_1cm;
      if (typeof m === "number") {
        points.push({ lat: it.latitude, lng: it.longitude, canopy: m });
      }
    }

    return NextResponse.json({ points });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "canopy fetch failed", points: [] },
      { status: 502 },
    );
  }
}
