"use client";

import { useEffect } from "react";

import { useHavenStore } from "@/store/useHavenStore";
import type { ResilienceHub, RouteToHub } from "@/types";

// Target = nearest hub that isn't known-closed. With current openNow being
// either true or null (we never produce false yet), this picks the nearest
// hub in practice — but the predicate is correct for when authoritative
// hours data lands later.
function pickTargetHub(hubs: ResilienceHub[]): ResilienceHub | null {
  if (hubs.length === 0) return null;
  return hubs.find((h) => h.openNow !== false) ?? hubs[0];
}

export default function RouteLoader() {
  const place = useHavenStore((s) => s.place);
  const hubs = useHavenStore((s) => s.hubs);
  const activeHazard = useHavenStore((s) => s.activeHazard);
  const setRoute = useHavenStore((s) => s.setRoute);

  useEffect(() => {
    if (!place || !hubs || activeHazard !== "heat") {
      setRoute(null);
      return;
    }
    const target = pickTargetHub(hubs);
    if (!target) {
      setRoute(null);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams({
          fromLat: String(place.lat),
          fromLng: String(place.lng),
          toLat: String(target.lat),
          toLng: String(target.lng),
        });
        const r = await fetch(`/api/route?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!r.ok) return;
        const data = (await r.json()) as {
          route: Omit<RouteToHub, "toHubId"> | null;
        };
        if (!data.route) return;
        setRoute({ ...data.route, toHubId: target.id });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Silent — UI degrades to "no route" cleanly.
      }
    })();

    return () => controller.abort();
  }, [place, hubs, activeHazard, setRoute]);

  return null;
}
