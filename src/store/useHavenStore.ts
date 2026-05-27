/**
 * useHavenStore — single source of truth for the HAVEN app.
 *
 * Holds the user's selected place, vulnerability profile, currently focused
 * hazard, the live point conditions, and the derived heat risk score.
 * Every HAVEN view (map overlay, score panel, AI advisor, trend chart)
 * reads from this store.
 */

import { create } from "zustand";

import { computeHeatScore } from "@/lib/heatScore";
import type {
  Conditions,
  Hazard,
  HeatScoreResult,
  HistoryPoint,
  Place,
  Profile,
} from "@/types";

const defaultProfile: Profile = {
  ageBand: "18to64",
  conditions: [],
  hasAC: true,
  outdoorWorker: false,
};

function deriveScore(
  conditions: Conditions | null,
  profile: Profile,
  activeHazard: Hazard,
): HeatScoreResult | null {
  if (!conditions || activeHazard !== "heat") return null;
  return computeHeatScore(conditions, profile);
}

type HavenState = {
  place: Place | null;
  profile: Profile;
  activeHazard: Hazard;
  conditions: Conditions | null;
  heatScore: HeatScoreResult | null;
  history: HistoryPoint[] | null;

  setPlace: (place: Place) => void;
  clearPlace: () => void;
  updateProfile: (partial: Partial<Profile>) => void;
  setActiveHazard: (hazard: Hazard) => void;
  resetProfile: () => void;
  setConditions: (conditions: Conditions | null) => void;
  setHistory: (history: HistoryPoint[] | null) => void;
};

export const useHavenStore = create<HavenState>()((set) => ({
  place: null,
  profile: defaultProfile,
  activeHazard: "heat",
  conditions: null,
  heatScore: null,
  history: null,

  setPlace: (place) => set({ place }),
  clearPlace: () =>
    set({
      place: null,
      conditions: null,
      heatScore: null,
      history: null,
    }),

  updateProfile: (partial) =>
    set((state) => {
      const profile = { ...state.profile, ...partial };
      return {
        profile,
        heatScore: deriveScore(state.conditions, profile, state.activeHazard),
      };
    }),

  setActiveHazard: (hazard) =>
    set((state) => ({
      activeHazard: hazard,
      heatScore: deriveScore(state.conditions, state.profile, hazard),
    })),

  resetProfile: () =>
    set((state) => ({
      profile: defaultProfile,
      heatScore: deriveScore(state.conditions, defaultProfile, state.activeHazard),
    })),

  setConditions: (conditions) =>
    set((state) => ({
      conditions,
      heatScore: deriveScore(conditions, state.profile, state.activeHazard),
    })),

  setHistory: (history) => set({ history }),
}));
