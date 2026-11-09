import { Lighthouse } from "@/components/asciicn/lighthouse";

export default function LighthouseHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <Lighthouse intensity={0.7} className="absolute inset-0 -z-20" />
      {/* A soft shade behind the copy, so it reads over the afterglow. */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_40%_32%_at_50%_52%,rgb(5_7_15/0.7),transparent)]" />
      <h3 className="max-w-lg text-3xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
        Keep the light on
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/75">
        Uptime alerts that wake the right person, and only them.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#start"
          className="rounded-md bg-[#fcb442] px-4 py-2 text-sm font-medium text-[#1a1206] transition-colors hover:bg-[#ffc664]"
        >
          Start free
        </a>
        <a
          href="#docs"
          className="rounded-md border border-white/25 bg-black/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          Read the docs
        </a>
      </div>
    </section>
  );
}
