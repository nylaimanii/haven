"use client";

import type { ReactNode } from "react";

import { useHavenStore } from "@/store/useHavenStore";
import type { AgeBand } from "@/types";

const AGE_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: "under18", label: "Under 18" },
  { value: "18to64", label: "18–64" },
  { value: "65plus", label: "65+" },
];

const CONDITIONS = [
  { id: "heart_condition", label: "Heart condition" },
  { id: "respiratory", label: "Respiratory" },
  { id: "pregnant", label: "Pregnant" },
  { id: "mobility", label: "Mobility limited" },
];

export default function ProfilePanel() {
  const profile = useHavenStore((s) => s.profile);
  const updateProfile = useHavenStore((s) => s.updateProfile);
  const resetProfile = useHavenStore((s) => s.resetProfile);

  function toggleCondition(id: string) {
    const next = profile.conditions.includes(id)
      ? profile.conditions.filter((c) => c !== id)
      : [...profile.conditions, id];
    updateProfile({ conditions: next });
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <Section label="Age">
        <div className="grid grid-cols-3 gap-1 rounded-md border border-haven-hairline p-1">
          {AGE_OPTIONS.map((opt) => {
            const active = profile.ageBand === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateProfile({ ageBand: opt.value })}
                aria-pressed={active}
                className={`flex h-11 items-center justify-center rounded px-2 text-xs transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Conditions">
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => {
            const active = profile.conditions.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCondition(c.id)}
                aria-pressed={active}
                className={`flex h-10 items-center rounded-full border px-3.5 text-xs transition-colors ${
                  active
                    ? "border-haven-heat/60 bg-haven-heat/15 text-foreground"
                    : "border-haven-hairline text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Toggle
        label="Air conditioning at home"
        checked={profile.hasAC}
        onChange={(v) => updateProfile({ hasAC: v })}
      />

      <Toggle
        label="I work/spend time outdoors"
        checked={profile.outdoorWorker}
        onChange={(v) => updateProfile({ outdoorWorker: v })}
      />

      <div className="pt-2">
        <button
          type="button"
          onClick={resetProfile}
          className="-mx-2 inline-flex h-11 items-center px-2 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          reset to defaults
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  // The entire row is the tap target so the 20×36 switch isn't the only
  // hit zone — a 65+ user can tap anywhere on the label and toggle it.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="-mx-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 text-left transition-colors hover:bg-foreground/5"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-haven-safe" : "bg-foreground/20"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-background transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
