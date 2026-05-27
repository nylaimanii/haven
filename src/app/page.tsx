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
      <ProfileButton />
    </main>
  );
}
