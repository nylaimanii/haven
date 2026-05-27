import { NextResponse } from "next/server";

// Flood-exposure PROXY for the MVP. We sample Open-Meteo's free Elevation API
// across the same 16x16 grid used for heat/canopy and render low-lying land
// in haven-flood blue. Low ground near water floods; high ground doesn't —
// the spatial signal is genuine and useful, but this is NOT a FEMA flood-
// zone determination. The UI labels it "indicative" prominently.
//
// TODO: integrate FEMA National Flood Hazard Layer for authoritative zones.

const OPEN_METEO_ELEV = "https://api.open-meteo.com/v1/elevation";
const GRID_N = 16; // must match the heat + canopy + client buildRasterURL grid
const DEFAULT_RADIUS_DEG = 0.075;
// Open-Meteo's Elevation endpoint rejects >100 coordinates per request
// (Forecast doesn't), so we chunk the 256-point grid into batches and merge.
const ELEV_CHUNK = 100;

export type FloodPoint = { lat: number; lng: number; elevation: number };

type ElevationResponse = { elevation?: number[] };

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
    const elevs: number[] = [];
    for (let start = 0; start < lats.length; start += ELEV_CHUNK) {
      const end = Math.min(start + ELEV_CHUNK, lats.length);
      const params = new URLSearchParams({
        latitude: lats.slice(start, end).join(","),
        longitude: lngs.slice(start, end).join(","),
      });
      const r = await fetch(`${OPEN_METEO_ELEV}?${params.toString()}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        return NextResponse.json(
          { error: `open-meteo elevation ${r.status}`, points: [] },
          { status: 502 },
        );
      }
      const j = (await r.json()) as ElevationResponse;
      const chunk = j.elevation ?? [];
      for (const e of chunk) elevs.push(e);
    }

    if (elevs.length !== lats.length) {
      return NextResponse.json(
        { error: "elevation count mismatch", points: [] },
        { status: 502 },
      );
    }

    const points: FloodPoint[] = [];
    for (let i = 0; i < lats.length; i++) {
      const e = elevs[i];
      if (typeof e === "number") {
        points.push({ lat: lats[i], lng: lngs[i], elevation: e });
      }
    }
    return NextResponse.json({ points });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "elevation fetch failed",
        points: [],
      },
      { status: 502 },
    );
  }
}
