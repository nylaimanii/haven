"use client";

import { useEffect } from "react";

import { useHavenStore } from "@/store/useHavenStore";
import type { ResilienceHub } from "@/types";

// Side-effect component: fetches nearby resilience hubs whenever a place is
// selected and the heat hazard is active. Clears on place change or hazard
// switch. Returns null — markers render in MapView from store.hubs.
export default function HubsLoader() {
  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);
  const setHubs = useHavenStore((s) => s.setHubs);

  useEffect(() => {
    if (!place || activeHazard !== "heat") {
      setHubs(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/hubs?lat=${place.lat}&lng=${place.lng}`,
          { signal: controller.signal },
        );
        if (!r.ok) return;
        const data = (await r.json()) as { hubs: ResilienceHub[] };
        setHubs(data.hubs ?? []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    })();
    return () => controller.abort();
  }, [place, activeHazard, setHubs]);

  return null;
}
