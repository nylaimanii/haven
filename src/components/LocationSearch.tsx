"use client";

import { useEffect, useRef, useState } from "react";

import { useHavenStore } from "@/store/useHavenStore";
import type { Place } from "@/types";

const DEBOUNCE_MS = 400;

export default function LocationSearch() {
  const setPlace = useHavenStore((s) => s.setPlace);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error("search failed");
        const data = (await r.json()) as { results: Place[] };
        setResults(data.results);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(p: Place) {
    setPlace(p);
    setQuery("");
    setResults([]);
    setError(null);
  }

  function handleGeolocate() {
    if (!("geolocation" in navigator)) {
      setError("geolocation not available in this browser");
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          if (!r.ok) throw new Error("reverse failed");
          const data = (await r.json()) as { result: Place };
          setPlace(data.result);
        } catch {
          setPlace({
            lat: latitude,
            lng: longitude,
            label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
          });
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        setError("couldn't get your location — search instead");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="relative w-full text-left">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search a city or address"
        className="w-full rounded-md border border-haven-hairline bg-haven-surface/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-haven-heat/60"
        aria-label="search location"
      />

      {results.length > 0 && (
        <ul className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-auto rounded-md border border-haven-hairline bg-haven-surface text-sm shadow-xl">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="block w-full truncate px-3 py-2 text-left hover:bg-foreground/5"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={geoLoading}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {geoLoading ? "locating…" : "use my location"}
        </button>
        {loading && (
          <span className="text-xs text-muted-foreground/60">searching…</span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-band-red/80" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
