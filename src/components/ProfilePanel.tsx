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
                className={`rounded px-2 py-1.5 text-xs transition-colors ${
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
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
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
          className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
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
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-haven-safe" : "bg-foreground/20"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-background transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
