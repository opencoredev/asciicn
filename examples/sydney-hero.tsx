import { Sydney } from "@/components/asciicn/sydney";

export default function SydneyHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 overflow-hidden bg-[#040818] px-6 pt-14 text-center text-white">
      <Sydney
        intensity={0.6}
        fireworks={0.6}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        See you on the harbour at midnight
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/70">
        Three shells at a time and 0.6 intensity keep the headline on top. Click
        the sky to launch another.
      </p>
    </section>
  );
}
