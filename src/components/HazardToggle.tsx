"use client";

import type { LucideIcon } from "lucide-react";
import { Droplets, Thermometer, Wind } from "lucide-react";

import { useHavenStore } from "@/store/useHavenStore";
import type { Hazard } from "@/types";

type HazardOption = {
  value: Hazard;
  label: string;
  Icon: LucideIcon;
  activeClass: string;
};

const HAZARDS: HazardOption[] = [
  {
    value: "heat",
    label: "Heat",
    Icon: Thermometer,
    activeClass: "border-haven-heat/60 bg-haven-heat/15 text-haven-heat",
  },
  {
    value: "flood",
    label: "Flood",
    Icon: Droplets,
    activeClass: "border-haven-flood/60 bg-haven-flood/15 text-haven-flood",
  },
  {
    value: "air",
    label: "Air",
    Icon: Wind,
    activeClass: "border-haven-air/60 bg-haven-air/15 text-haven-air",
  },
];

export default function HazardToggle() {
  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);
  const setActiveHazard = useHavenStore((s) => s.setActiveHazard);

  if (!place) return null;

  return (
    // Asymmetric padding on mobile keeps the centered toggle clear of the
    // top-right ProfileButton at narrow widths (a 360px viewport otherwise
    // sees a ~1px touch between the right-most pill button and the avatar).
    <div className="pointer-events-none fixed inset-x-0 top-20 z-10 flex justify-center pl-4 pr-20 sm:px-4">
      <div
        role="group"
        aria-label="hazard layer"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-haven-hairline bg-haven-surface/80 p-1 shadow-xl backdrop-blur-md"
      >
        {HAZARDS.map((h) => {
          const active = activeHazard === h.value;
          return (
            <button
              key={h.value}
              type="button"
              onClick={() => setActiveHazard(h.value)}
              aria-pressed={active}
              className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs transition-colors ${
                active
                  ? h.activeClass
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <h.Icon className="size-3.5" />
              {h.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
