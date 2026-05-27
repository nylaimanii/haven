"use client";

import { useEffect } from "react";

import { useHavenStore } from "@/store/useHavenStore";
import type { Conditions } from "@/types";

// Side-effect component: keeps store.conditions in sync with store.place.
// No UI of its own. Step 13's score panel will consume the result.
export default function ConditionsLoader() {
  const place = useHavenStore((s) => s.place);
  const setConditions = useHavenStore((s) => s.setConditions);

  useEffect(() => {
    if (!place) {
      setConditions(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/conditions?lat=${place.lat}&lng=${place.lng}`,
          { signal: controller.signal },
        );
        if (!r.ok) return;
        const data = (await r.json()) as Conditions;
        setConditions(data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Silent — no UI surface for this yet (step 13 will own that).
      }
    })();
    return () => controller.abort();
  }, [place, setConditions]);

  return null;
}
