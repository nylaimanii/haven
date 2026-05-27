"use client";

import { useEffect, useState } from "react";

import { BarChart3, X } from "lucide-react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

import { useHavenStore } from "@/store/useHavenStore";

import MigrationTeaser from "./MigrationTeaser";

// Recharts is heavy (~110 kB). Defer it until the user opens the panel so
// it doesn't bloat the initial page load.
const TrendChart = dynamic(() => import("./TrendChart"), { ssr: false });

export default function TrendPanel() {
  const heatTrend = useHavenStore((s) => s.heatTrend);
  const activeHazard = useHavenStore((s) => s.activeHazard);
  const [open, setOpen] = useState(false);

  // Portal target — `document` doesn't exist during SSR, so flip a mounted
  // flag after first client paint and only call createPortal afterwards.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC closes the drawer when open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-close if the trend or hazard changes out from under us
  // (e.g. user picks "change" or switches to Flood while panel is open).
  useEffect(() => {
    if (!heatTrend || activeHazard !== "heat") setOpen(false);
  }, [heatTrend, activeHazard]);

  if (!heatTrend || activeHazard !== "heat") return null;

  const drawer = (
    <>
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Heat trend"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-2xl flex-col border-l border-haven-hairline bg-haven-surface shadow-2xl backdrop-blur-md transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-haven-hairline px-6 py-4">
          <h2 className="text-sm font-semibold tracking-tight">Heat trend</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {open && (
            <>
              <TrendChart trend={heatTrend} />
              <MigrationTeaser trend={heatTrend} />
            </>
          )}
        </div>
      </aside>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto inline-flex items-center gap-1.5 self-start rounded-lg border border-haven-hairline bg-haven-surface/80 px-3 py-2 text-xs text-muted-foreground shadow-xl backdrop-blur-md transition-colors hover:text-foreground"
      >
        <BarChart3 className="size-3.5" aria-hidden />
        See trend
      </button>
      {/*
        The drawer must escape the bottom-left card column's z-10 stacking
        context, otherwise its z-40 is capped within that local scope and the
        z-20 ProfileButton in <main> ends up rendering on top of the close
        button. Portaling to body promotes it to the document root stacking
        context so its z-index actually takes effect.
      */}
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
