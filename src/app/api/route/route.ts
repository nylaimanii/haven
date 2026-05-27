import { NextResponse } from "next/server";

// Walking route between two points via the public OSRM demo server.
// The demo endpoint is rate-limited and occasionally slow — we time out at 8s
// and return null route on failure so the UI degrades gracefully (no line,
// no crash). For now this is a plain shortest-path walk; a true "shaded
// route" needs canopy-weighted routing.
// TODO: weight route by canopy/shade once we have routable canopy data.

const OSRM = "https://router.project-osrm.org/route/v1/foot";
const TIMEOUT_MS = 8000;
// Standard average walking pace (~5 km/h). The OSRM demo server's `foot`
// profile sometimes returns car-pace durations, so we trust its geometry
// (the path is fine for short urban walks) and compute time from distance.
const WALKING_SPEED_MPS = 1.4;

type OsrmGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type OsrmRoute = {
  geometry: OsrmGeometry;
  distance: number;
  duration: number;
};

type OsrmResponse = {
  routes?: OsrmRoute[];
};

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromLat = num(searchParams.get("fromLat"));
  const fromLng = num(searchParams.get("fromLng"));
  const toLat = num(searchParams.get("toLat"));
  const toLng = num(searchParams.get("toLng"));

  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
    return NextResponse.json(
      { error: "missing fromLat/fromLng/toLat/toLng", route: null },
      { status: 400 },
    );
  }

  const url = `${OSRM}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!r.ok) {
      return NextResponse.json(
        { error: `osrm ${r.status}`, route: null },
        { status: 502 },
      );
    }
    const j = (await r.json()) as OsrmResponse;
    const route = j.routes?.[0];
    if (!route || route.geometry?.type !== "LineString") {
      return NextResponse.json({ route: null }, { status: 502 });
    }
    const distanceM = Math.round(route.distance);
    return NextResponse.json({
      route: {
        geometry: route.geometry,
        distanceM,
        durationS: Math.round(distanceM / WALKING_SPEED_MPS),
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "route fetch failed",
        route: null,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
