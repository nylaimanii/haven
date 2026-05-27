"use client";

import { Footprints, Target, TrendingUp } from "lucide-react";

import { useHavenStore } from "@/store/useHavenStore";

import LocationSearch from "./LocationSearch";

type ValueProp = {
  Icon: typeof Target;
  title: string;
  body: string;
};

const VALUE_PROPS: ValueProp[] = [
  {
    Icon: Target,
    title: "Hyperlocal & personal",
    body: "Block-level risk tuned to your age, health, AC access, and outdoor exposure — not a city-wide forecast.",
  },
  {
    Icon: TrendingUp,
    title: "Is your place getting worse?",
    body: "20+ years of real climate data showing your area’s actual trajectory — the adaptation differentiator.",
  },
  {
    Icon: Footprints,
    title: "Know what to do, and where to go",
    body: "A personal plan from the deterministic risk engine + the nearest cooling center, with a walking route.",
  },
];

export default function IntroCard() {
  const place = useHavenStore((s) => s.place);
  const clearPlace = useHavenStore((s) => s.clearPlace);

  // Compact pill once a place is selected — the map experience takes over.
  if (place) {
    return (
      // Asymmetric padding on mobile (pr-20) keeps the centered pill clear of
      // the top-right ProfileButton (z-20). Resets to symmetric px-4 at sm+.
      <div className="pointer-events-none fixed inset-x-0 top-4 z-10 flex justify-center pl-4 pr-20 sm:px-4">
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

  // Full landing — fixed-position scrollable overlay above the dark base map.
  return (
    <div className="pointer-events-auto fixed inset-0 z-10 overflow-y-auto bg-background/85 backdrop-blur-md">
      {/* Subtle heat-accent radial behind the hero, echoing the map visualization. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[80vh]"
        style={{
          background:
            "radial-gradient(70vh circle at 50% 35%, var(--haven-heat) 0%, transparent 55%)",
          opacity: 0.08,
        }}
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
        <span className="font-medium tracking-tight text-foreground">
          HAVEN
        </span>
        <span className="hidden sm:inline">
          Personal climate-adaptation layer
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-16 pt-12 text-center sm:pt-20">
        <p className="text-[10px] uppercase tracking-[0.2em] text-haven-heat/80">
          Adaptation, not prevention
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
          The next 20 years of climate
          <br className="hidden sm:block" /> are already on the way.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          HAVEN turns hyperlocal heat, flooding, and air quality into a
          block-level plan tuned to your age, your health, and your home —
          so you know what to do today and where your area is headed.
        </p>

        <div className="mx-auto mt-10 max-w-md rounded-xl border border-haven-hairline bg-haven-surface/70 p-5 shadow-2xl backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Get started
          </p>
          <div className="mt-3">
            <LocationSearch />
          </div>
        </div>
      </main>

      <section className="border-t border-haven-hairline bg-haven-surface/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-14">
          <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/70">
            What HAVEN does
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {VALUE_PROPS.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-haven-hairline bg-haven-surface/60 p-5"
              >
                <Icon className="size-5 text-haven-heat" aria-hidden />
                <h3 className="mt-3 text-sm font-medium text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-haven-hairline">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 text-center text-xs leading-relaxed text-muted-foreground">
          <p className="text-foreground/80">
            Built with real, free climate data.
          </p>
          <p className="mt-2">
            Live conditions from{" "}
            <span className="text-foreground/80">NWS</span> · 20+ years of
            history and current air quality from{" "}
            <span className="text-foreground/80">Open-Meteo</span> · resilience
            hubs and routes from{" "}
            <span className="text-foreground/80">OpenStreetMap</span>.
          </p>
          <p className="mt-3 text-muted-foreground/70">
            Heat is the deep vertical with full scoring, plan, and trend.
            Air quality is live US AQI. Flood is an indicative elevation
            signal — not official flood maps.
          </p>
        </div>
      </footer>
    </div>
  );
}
