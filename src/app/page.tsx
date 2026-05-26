export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60vh circle at 50% 42%, var(--haven-heat) 0%, transparent 60%)",
          opacity: 0.08,
        }}
      />
      <h1 className="text-7xl md:text-8xl font-semibold tracking-tighter">
        HAVEN
      </h1>
      <p className="mt-4 text-base md:text-lg text-muted-foreground">
        personal climate-adaptation layer
      </p>
      <p className="mt-12 text-xs md:text-sm text-muted-foreground/50">
        select a location to begin
      </p>
    </main>
  );
}
