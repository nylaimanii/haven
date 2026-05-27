import { NextResponse } from "next/server";

import type { Place } from "@/types";

const NOMINATIM = "https://nominatim.openstreetmap.org";

// Nominatim usage policy requires a descriptive identifier for the client.
// Setting User-Agent server-side keeps us compliant and avoids browser CORS.
const HEADERS = {
  "User-Agent": "HAVEN-climate-app (github.com/nylaimanii/haven)",
  Accept: "application/json",
};

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
};

function toPlace(item: NominatimItem): Place {
  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    label: item.display_name,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  try {
    if (q && q.trim().length > 0) {
      const url = `${NOMINATIM}/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: HEADERS, cache: "no-store" });
      if (!r.ok) {
        return NextResponse.json(
          { error: `nominatim ${r.status}` },
          { status: 502 },
        );
      }
      const data = (await r.json()) as NominatimItem[];
      return NextResponse.json({ results: data.map(toPlace) });
    }

    if (lat && lng) {
      const url = `${NOMINATIM}/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
      const r = await fetch(url, { headers: HEADERS, cache: "no-store" });
      if (!r.ok) {
        return NextResponse.json(
          { error: `nominatim ${r.status}` },
          { status: 502 },
        );
      }
      const data = (await r.json()) as NominatimItem;
      return NextResponse.json({ result: toPlace(data) });
    }

    return NextResponse.json(
      { error: "missing q or lat/lng" },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "geocode failed" },
      { status: 502 },
    );
  }
}
