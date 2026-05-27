"use client";

import type { LucideIcon } from "lucide-react";
import { Droplets, Wind } from "lucide-react";

import { useHavenStore } from "@/store/useHavenStore";

type Hint = { label: string; Icon: LucideIcon; accentClass: string };

const HINTS: Record<"flood" | "air", Hint> = {
  flood: {
    label: "Flood layer coming soon",
    Icon: Droplets,
    accentClass: "text-haven-flood border-haven-flood/40",
  },
  air: {
    label: "Air quality layer coming soon",
    Icon: Wind,
    accentClass: "text-haven-air border-haven-air/40",
  },
};

export default function HazardHint() {
  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);

  if (!place) return null;
  if (activeHazard !== "flood" && activeHazard !== "air") return null;

  const hint = HINTS[activeHazard];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-10 flex justify-center px-4">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border bg-haven-surface/80 px-4 py-2 text-xs shadow-xl backdrop-blur-md ${hint.accentClass}`}
      >
        <hint.Icon className="size-4" />
        <span>{hint.label}</span>
      </div>
    </div>
  );
}
