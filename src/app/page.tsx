import AdvisorCard from "@/components/AdvisorCard";
import AdvisorLoader from "@/components/AdvisorLoader";
import ConditionsLoader from "@/components/ConditionsLoader";
import HazardHint from "@/components/HazardHint";
import HazardToggle from "@/components/HazardToggle";
import HeatScoreCard from "@/components/HeatScoreCard";
import HistoryLoader from "@/components/HistoryLoader";
import IntroCard from "@/components/IntroCard";
import MapView from "@/components/MapViewClient";
import ProfileButton from "@/components/ProfileButton";

export default function Home() {
  return (
    <main>
      <div className="fixed inset-0 z-0 bg-background">
        <MapView />
      </div>
      <IntroCard />
      <HazardToggle />
      <HazardHint />
      <div className="pointer-events-none fixed bottom-6 left-4 z-10 flex max-h-[calc(100vh-7rem)] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto sm:max-w-xs">
        <HeatScoreCard />
        <AdvisorCard />
      </div>
      <ProfileButton />
      <ConditionsLoader />
      <HistoryLoader />
      <AdvisorLoader />
    </main>
  );
}
