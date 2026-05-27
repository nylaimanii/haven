/**
 * useHavenStore — single source of truth for the HAVEN app.
 *
 * Holds the user's selected place, their vulnerability profile, and the
 * currently focused hazard. Every HAVEN view (map overlay, score panel,
 * AI advisor, trend chart) reads from this store.
 */

import { create } from "zustand";

import type { Conditions, Hazard, Place, Profile } from "@/types";

const defaultProfile: Profile = {
  ageBand: "18to64",
  conditions: [],
  hasAC: true,
  outdoorWorker: false,
};

type HavenState = {
  place: Place | null;
  profile: Profile;
  activeHazard: Hazard;
  conditions: Conditions | null;

  setPlace: (place: Place) => void;
  clearPlace: () => void;
  updateProfile: (partial: Partial<Profile>) => void;
  setActiveHazard: (hazard: Hazard) => void;
  resetProfile: () => void;
  setConditions: (conditions: Conditions | null) => void;
};

export const useHavenStore = create<HavenState>()((set) => ({
  place: null,
  profile: defaultProfile,
  activeHazard: "heat",
  conditions: null,

  setPlace: (place) => set({ place }),
  clearPlace: () => set({ place: null, conditions: null }),
  updateProfile: (partial) =>
    set((state) => ({ profile: { ...state.profile, ...partial } })),
  setActiveHazard: (hazard) => set({ activeHazard: hazard }),
  resetProfile: () => set({ profile: defaultProfile }),
  setConditions: (conditions) => set({ conditions }),
}));
