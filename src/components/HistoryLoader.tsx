"use client";

import { useEffect } from "react";

import { useHavenStore } from "@/store/useHavenStore";
import type { HistoryPoint } from "@/types";

// Side-effect component: keeps store.history in sync with store.place.
// Runs in parallel with ConditionsLoader — both useEffects fire on place
// change and their fetches start independently, so the score card never waits
// on the larger historical payload. No UI of its own.
export default function HistoryLoader() {
  const place = useHavenStore((s) => s.place);
  const setHistory = useHavenStore((s) => s.setHistory);

  useEffect(() => {
    if (!place) {
      setHistory(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/history?lat=${place.lat}&lng=${place.lng}`,
          { signal: controller.signal },
        );
        if (!r.ok) return;
        const data = (await r.json()) as { daily: HistoryPoint[] };
        setHistory(data.daily ?? []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Silent — UI doesn't depend on this yet (step 16/22 will own that).
      }
    })();
    return () => controller.abort();
  }, [place, setHistory]);

  return null;
}
