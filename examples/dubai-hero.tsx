import { Dubai } from "@/components/asciicn/dubai";

export default function DubaiHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center text-white">
      <Dubai intensity={0.6} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Ship from the desert
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/70">
        Dimmed to 60%, so the headline reads first and the spire still shows.
      </p>
    </section>
  );
}
