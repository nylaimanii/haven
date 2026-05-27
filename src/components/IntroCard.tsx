"use client";

import { useHavenStore } from "@/store/useHavenStore";

import LocationSearch from "./LocationSearch";

export default function IntroCard() {
  const place = useHavenStore((s) => s.place);
  const clearPlace = useHavenStore((s) => s.clearPlace);

  if (place) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-4 z-10 flex justify-center px-4">
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-haven-hairline bg-haven-surface/80 px-4 py-2 text-sm shadow-xl backdrop-blur-md">
          <span className="font-medium tracking-tight">HAVEN</span>
          <span className="truncate text-muted-foreground" title={place.label}>
            {place.label}
          </span>
          <button
            type="button"
            onClick={clearPlace}
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-haven-hairline bg-haven-surface/80 px-8 py-10 text-center shadow-2xl backdrop-blur-md">
        <h1 className="text-5xl font-semibold tracking-tighter md:text-6xl">
          HAVEN
        </h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          personal climate-adaptation layer
        </p>
        <p className="mt-8 text-xs text-muted-foreground/50 md:text-sm">
          select a location to begin
        </p>
        <div className="mt-6">
          <LocationSearch />
        </div>
      </div>
    </div>
  );
}
