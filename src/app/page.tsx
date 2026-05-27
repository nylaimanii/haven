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
      <HeatScoreCard />
      <ProfileButton />
      <ConditionsLoader />
      <HistoryLoader />
      <AdvisorLoader />
    </main>
  );
}
