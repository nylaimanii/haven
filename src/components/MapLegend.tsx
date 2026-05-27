"use client";

import { useHavenStore } from "@/store/useHavenStore";

// Compact key for the heat + canopy raster colors. Shown only when the heat
// hazard is active for a selected place — same visibility rule as the rasters
// themselves, so it appears and clears together with them.
export default function MapLegend() {
  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);

  if (!place || activeHazard !== "heat") return null;

  return (
    <div className="pointer-events-none fixed bottom-32 right-4 z-10">
      <div className="pointer-events-auto rounded-lg border border-haven-hairline bg-haven-surface/80 px-3 py-2 text-[10px] shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 text-foreground/85">
          <span aria-hidden className="block h-2.5 w-4 rounded-full bg-haven-heat" />
          <span>Hotter</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-foreground/85">
          <span aria-hidden className="block h-2.5 w-4 rounded-full bg-haven-safe" />
          <span>More shade / cooler</span>
        </div>
      </div>
    </div>
  );
}
