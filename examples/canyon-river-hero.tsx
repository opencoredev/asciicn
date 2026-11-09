import { CanyonRiver } from "@/components/asciicn/canyon-river";

export default function CanyonRiverHero() {
  return (
    <section className="relative isolate flex size-full min-h-96 flex-col items-center justify-center gap-4 overflow-hidden bg-[#0b0a1c] px-6 text-center text-white">
      <CanyonRiver intensity={0.65} className="absolute inset-0 -z-10" />
      <h3 className="max-w-2xl text-4xl font-medium tracking-[-0.03em] text-balance [text-shadow:0_1px_24px_rgb(11_10_28/0.9)] sm:text-5xl">
        Ship before the light goes
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/75 [text-shadow:0_1px_16px_rgb(11_10_28/0.9)]">
        At 0.65 intensity the middle of the canyon sits back and the headline
        reads first.
      </p>
      <div className="mt-2 flex gap-3">
        <a
          href="#get-started"
          className="rounded-md bg-[#fcb442] px-4 py-2 text-sm font-medium text-[#1a0c12]"
        >
          Get started
        </a>
        <a
          href="#docs"
          className="rounded-md border border-white/25 bg-[#0b0a1c]/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
        >
          Read the docs
        </a>
      </div>
    </section>
  );
}
