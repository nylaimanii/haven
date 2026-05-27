"use client";

import { Wind } from "lucide-react";

import { useHavenStore } from "@/store/useHavenStore";

// "Coming soon" hint reserved for the Air hazard while we wire authoritative
// AQI data (step 24). Flood now has its own indicative-exposure raster + a
// dedicated legend via MapLegend, so it no longer takes this chip.
export default function HazardHint() {
  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);

  if (!place) return null;
  if (activeHazard !== "air") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-10 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-haven-air/40 bg-haven-surface/80 px-4 py-2 text-xs text-haven-air shadow-xl backdrop-blur-md">
        <Wind className="size-4" aria-hidden />
        <span>Air quality layer coming soon</span>
      </div>
    </div>
  );
}
