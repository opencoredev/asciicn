import { BlackHole } from "@/components/asciicn/black-hole";

export default function BlackHoleHero() {
  return (
    <section className="relative isolate flex h-[500px] w-full flex-col items-center justify-end overflow-hidden pb-8">
      <BlackHole scale={0.62} speed={0.7} className="absolute inset-0 -z-10" />
      <div className="text-center">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.3em] uppercase">
          Event horizon
        </p>
        <h3 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-balance">
          Everything falls in eventually
        </h3>
      </div>
    </section>
  );
}
