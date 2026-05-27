"use client";

import { useHavenStore } from "@/store/useHavenStore";

// Compact key for whatever raster is currently active on the map. Heat shows
// a 2-swatch warm/green key. Flood shows a blue swatch + an explicit
// "indicative — not official flood maps" disclaimer so users never mistake
// our elevation proxy for FEMA flood-zone data.
export default function MapLegend() {
  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);

  if (!place) return null;

  if (activeHazard === "heat") {
    return (
      <div className="pointer-events-none fixed bottom-32 right-4 z-10">
        <div className="pointer-events-auto rounded-lg border border-haven-hairline bg-haven-surface/80 px-3 py-2 text-[10px] shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-foreground/85">
            <span
              aria-hidden
              className="block h-2.5 w-4 rounded-full bg-haven-heat"
            />
            <span>Hotter</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-foreground/85">
            <span
              aria-hidden
              className="block h-2.5 w-4 rounded-full bg-haven-safe"
            />
            <span>More shade / cooler</span>
          </div>
        </div>
      </div>
    );
  }

  if (activeHazard === "flood") {
    return (
      <div className="pointer-events-none fixed bottom-32 right-4 z-10 max-w-[260px]">
        <div className="pointer-events-auto rounded-lg border border-haven-flood/40 bg-haven-surface/85 px-3 py-2 text-[10px] shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-haven-flood">
              Flood exposure
            </span>
            <span className="text-muted-foreground/60">(indicative)</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-foreground/85">
            <span
              aria-hidden
              className="block h-2.5 w-4 rounded-full bg-haven-flood"
            />
            <span>Lower-lying / higher exposure</span>
          </div>
          <p className="mt-1.5 leading-snug text-muted-foreground">
            Based on elevation — not official flood maps.
          </p>
        </div>
      </div>
    );
  }

  if (activeHazard === "air") {
    return (
      <div className="pointer-events-none fixed bottom-32 right-4 z-10 max-w-[240px]">
        <div className="pointer-events-auto rounded-lg border border-haven-air/40 bg-haven-surface/85 px-3 py-2 text-[10px] shadow-xl backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-widest text-haven-air">
            Air quality (US AQI)
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-foreground/85">
            <span
              aria-hidden
              className="block h-2.5 w-12 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, rgba(217,166,72,0), #D9A648 50%, #964628)",
              }}
            />
            <span>Cleaner → More pollution</span>
          </div>
          <p className="mt-1.5 leading-snug text-muted-foreground">
            Live current AQI from Open-Meteo.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
