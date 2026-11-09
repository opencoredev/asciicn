import { Paris } from "@/components/asciicn/paris";

export default function ParisHero() {
  return (
    <section className="relative isolate flex size-full min-h-[420px] flex-col items-center justify-center gap-5 px-6 text-center text-white">
      <Paris intensity={0.85} className="absolute inset-0 -z-10" />
      <h3 className="max-w-xl text-3xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
        Ship it before the lights come on
      </h3>
      <p className="max-w-md text-sm text-pretty text-white/75 sm:text-base">
        A launch week in Paris, with the tower lit gold beside the headline.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#get-started"
          className="rounded-full bg-[#fcb442] px-5 py-2 text-sm font-medium text-[#1a1206]"
        >
          Get started
        </a>
        <a
          href="#docs"
          className="rounded-full border border-white/25 bg-white/5 px-5 py-2 text-sm font-medium text-white backdrop-blur-sm"
        >
          Read the docs
        </a>
      </div>
    </section>
  );
}
