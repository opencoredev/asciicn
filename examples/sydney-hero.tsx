import { Sydney } from "@/components/asciicn/sydney";

// At 0.6 intensity the harbour sits back and the headline reads first.
export default function SydneyHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 overflow-hidden bg-[#050916] px-6 pt-14 text-center text-white">
      <Sydney intensity={0.6} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        See you on the harbour tonight
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/70">
        At 0.6 intensity the harbour dims and thins, and the headline reads
        first.
      </p>
    </section>
  );
}
