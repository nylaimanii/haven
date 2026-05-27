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
import { computeHeatTrend } from "@/lib/heatTrend";
import type {
  AdvisorResult,
  Conditions,
  Hazard,
  HeatScoreResult,
  HeatTrendResult,
  HistoryPoint,
  Place,
  Profile,
  ResilienceHub,
  RouteToHub,
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
  heatTrend: HeatTrendResult | null;
  advisor: AdvisorResult | null;
  hubs: ResilienceHub[] | null;
  route: RouteToHub | null;
  // Transient flag: set true by `goSearch` (the pill's "change") so that the
  // landing's LocationSearch auto-focuses its input on mount. False after a
  // fresh page load and after any focus consumer clears it.
  shouldFocusSearch: boolean;

  setPlace: (place: Place) => void;
  clearPlace: () => void;
  goSearch: () => void;
  clearFocusFlag: () => void;
  updateProfile: (partial: Partial<Profile>) => void;
  setActiveHazard: (hazard: Hazard) => void;
  resetProfile: () => void;
  setConditions: (conditions: Conditions | null) => void;
  setHistory: (history: HistoryPoint[] | null) => void;
  setAdvisor: (advisor: AdvisorResult | null) => void;
  setHubs: (hubs: ResilienceHub[] | null) => void;
  setRoute: (route: RouteToHub | null) => void;
  loadDemo: () => void;
};

const FULL_PLACE_RESET = {
  place: null,
  conditions: null,
  heatScore: null,
  history: null,
  heatTrend: null,
  advisor: null,
  hubs: null,
  route: null,
} satisfies Partial<HavenState>;

// One-tap demo: real Newark place + a deliberately vulnerable profile so the
// score lands at a meaningful band even on a mild day. The profile is still
// fully editable via the existing drawer — nothing is hidden.
const DEMO_PLACE: Place = {
  lat: 40.7357,
  lng: -74.1724,
  label: "Newark, NJ",
};

const DEMO_PROFILE: Profile = {
  ageBand: "65plus",
  conditions: ["heart_condition"],
  hasAC: false,
  outdoorWorker: true,
};

export const useHavenStore = create<HavenState>()((set) => ({
  place: null,
  profile: defaultProfile,
  activeHazard: "heat",
  conditions: null,
  heatScore: null,
  history: null,
  heatTrend: null,
  advisor: null,
  hubs: null,
  route: null,
  shouldFocusSearch: false,

  setPlace: (place) => set({ place }),
  // "Home": wipe everything, return to the clean landing. No auto-focus.
  clearPlace: () => set({ ...FULL_PLACE_RESET, shouldFocusSearch: false }),
  // "Change": wipe everything but flag the search input to auto-focus on the
  // returning landing — so the user can immediately type a new location.
  goSearch: () => set({ ...FULL_PLACE_RESET, shouldFocusSearch: true }),
  clearFocusFlag: () => set({ shouldFocusSearch: false }),

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

  setHistory: (history) =>
    set({
      history,
      heatTrend: history ? computeHeatTrend(history) : null,
    }),

  setAdvisor: (advisor) => set({ advisor }),

  setHubs: (hubs) => set({ hubs }),

  setRoute: (route) => set({ route }),

  // Atomic seed: place + profile in one set() so the conditions loader fires
  // against the demo profile (not the previous default). Also resets ALL
  // dependent state so a returning visitor doesn't see stale conditions/
  // trend/hubs/route from a prior place flash in before the new ones load.
  loadDemo: () =>
    set({
      ...FULL_PLACE_RESET,
      place: DEMO_PLACE,
      profile: DEMO_PROFILE,
      shouldFocusSearch: false,
    }),
}));
