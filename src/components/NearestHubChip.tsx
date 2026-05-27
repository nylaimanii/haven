"use client";

import { Footprints } from "lucide-react";

import { useHavenStore } from "@/store/useHavenStore";

export default function NearestHubChip() {
  const route = useHavenStore((s) => s.route);
  const hubs = useHavenStore((s) => s.hubs);
  const activeHazard = useHavenStore((s) => s.activeHazard);

  if (!route || activeHazard !== "heat") return null;
  const target = hubs?.find((h) => h.id === route.toHubId);
  if (!target) return null;

  const minutes = Math.max(1, Math.round(route.durationS / 60));
  const km = (route.distanceM / 1000).toFixed(1);

  return (
    <div className="pointer-events-auto rounded-lg border border-haven-hairline bg-haven-surface/80 px-3 py-2 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70">
        <Footprints className="size-3 text-haven-safe" aria-hidden />
        <span>Nearest cooling center</span>
      </div>
      <p
        className="mt-1 truncate text-xs font-medium text-foreground"
        title={target.name}
      >
        {target.name}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {minutes} min walk · {km} km
        {target.openNow === true && (
          <>
            {" · "}
            <span className="text-haven-safe">open</span>
          </>
        )}
        {target.openNow === false && (
          <>
            {" · "}
            <span className="text-muted-foreground/60">closed</span>
          </>
        )}
      </p>
    </div>
  );
}
