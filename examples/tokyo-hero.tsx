import { Tokyo } from "@/components/asciicn/tokyo";

export default function TokyoHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 overflow-hidden bg-[#03050d] px-6 pt-14 text-center text-white">
      <Tokyo intensity={0.55} neon={0.7} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Last train from Hamamatsucho
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/70">
        At 0.55 intensity the city sits back and the headline stays easy to
        read.
      </p>
    </section>
  );
}
