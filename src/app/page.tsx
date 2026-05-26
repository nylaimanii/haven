import MapView from "@/components/MapViewClient";

export default function Home() {
  return (
    <main>
      <div className="fixed inset-0 z-0 bg-background">
        <MapView />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center px-4">
        <div className="pointer-events-auto w-full max-w-md rounded-xl border border-haven-hairline bg-haven-surface/80 px-8 py-10 text-center shadow-2xl backdrop-blur-md">
          <h1 className="text-5xl font-semibold tracking-tighter md:text-6xl">
            HAVEN
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            personal climate-adaptation layer
          </p>
          <p className="mt-8 text-xs text-muted-foreground/50 md:text-sm">
            select a location to begin
          </p>
        </div>
      </div>
    </main>
  );
}
