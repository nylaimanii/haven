import { NextResponse } from "next/server";

import type { ResilienceHub } from "@/types";

// Nearest resilience hubs (libraries + community centres) for the selected
// place — sourced from OpenStreetMap via the free Overpass API. No key.
// We sort by haversine distance and return up to 10.
//
// "openNow" is conservative: real opening_hours parsing needs the venue's
// timezone (which the server doesn't know) plus a full opening_hours.js
// grammar. We honour "24/7" reliably and otherwise return null (unknown)
// rather than risk a wrong answer. The UI renders unknown-state markers
// distinctly so users can see we're not pretending to know.
//
// TODO: integrate authoritative municipal cooling-center hours/status when
//       we self-host a curated dataset.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const RADIUS_M = 5000; // 5 km
const MAX_HUBS = 10;
const UA = "HAVEN-climate-app (github.com/nylaimanii/haven)";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
};

type OverpassResponse = { elements?: OverpassElement[] };

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deriveOpenNow(openingHours?: string): boolean | null {
  if (!openingHours) return null;
  if (openingHours.trim() === "24/7") return true;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });
  }

  const query = `[out:json][timeout:25];
(
  node["amenity"~"^(library|community_centre)$"](around:${RADIUS_M},${lat},${lng});
  way["amenity"~"^(library|community_centre)$"](around:${RADIUS_M},${lat},${lng});
);
out center tags;`;

  try {
    const r = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
        Accept: "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `overpass ${r.status}`, hubs: [] },
        { status: 502 },
      );
    }
    const j = (await r.json()) as OverpassResponse;
    const elements = j.elements ?? [];

    const hubs: ResilienceHub[] = [];
    for (const e of elements) {
      const eLat = e.lat ?? e.center?.lat;
      const eLng = e.lon ?? e.center?.lon;
      if (typeof eLat !== "number" || typeof eLng !== "number") continue;
      const tags = e.tags ?? {};
      const amenity = tags.amenity;
      if (amenity !== "library" && amenity !== "community_centre") continue;
      const name =
        tags.name?.trim() ||
        (amenity === "library" ? "Library" : "Community Center");
      hubs.push({
        id: `${e.type}/${e.id}`,
        name,
        type: amenity,
        lat: eLat,
        lng: eLng,
        distanceMeters: Math.round(haversineM(lat, lng, eLat, eLng)),
        openNow: deriveOpenNow(tags.opening_hours),
      });
    }

    hubs.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return NextResponse.json({ hubs: hubs.slice(0, MAX_HUBS) });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "hub fetch failed",
        hubs: [],
      },
      { status: 502 },
    );
  }
}
