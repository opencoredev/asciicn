import { RiceTerraces } from "@/components/asciicn/rice-terraces";

// Full-bleed behind a centred headline: at 0.8 intensity the middle of the
// frame quiets further, and the text and buttons read first.
export default function RiceTerracesHero() {
  return (
    <section className="relative isolate flex size-full min-h-[480px] flex-col items-center justify-center gap-5 px-6 text-center text-white">
      <RiceTerraces intensity={0.8} className="absolute inset-0 -z-10" />
      <h3 className="max-w-xl text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
        Grow it one terrace at a time
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/75">
        Small steps, each one level, each one holding the light.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#get-started"
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#141226] transition-colors hover:bg-white/85"
        >
          Get started
        </a>
        <a
          href="#tour"
          className="rounded-full border border-white/35 bg-white/5 px-5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15"
        >
          Take the tour
        </a>
      </div>
    </section>
  );
}
