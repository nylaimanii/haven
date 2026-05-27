import AdvisorCard from "@/components/AdvisorCard";
import AdvisorLoader from "@/components/AdvisorLoader";
import ConditionsLoader from "@/components/ConditionsLoader";
import HazardHint from "@/components/HazardHint";
import HazardToggle from "@/components/HazardToggle";
import HeatScoreCard from "@/components/HeatScoreCard";
import HistoryLoader from "@/components/HistoryLoader";
import HubsLoader from "@/components/HubsLoader";
import IntroCard from "@/components/IntroCard";
import MapLegend from "@/components/MapLegend";
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
      <div className="pointer-events-none fixed bottom-6 left-4 z-10 flex max-h-[calc(100vh-7rem)] max-w-[300px] flex-col gap-3 overflow-y-auto sm:max-w-xs">
        <HeatScoreCard />
        <AdvisorCard />
      </div>
      <MapLegend />
      <ProfileButton />
      <ConditionsLoader />
      <HistoryLoader />
      <HubsLoader />
      <AdvisorLoader />
    </main>
  );
}
