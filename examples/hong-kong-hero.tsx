import { HongKong } from "@/components/asciicn/hong-kong";

// Full-bleed behind a centred headline. At 0.65 intensity the middle band,
// where the text sits, drops back most; the two towers stand either side
// of it and the junk crosses the harbour below.
export default function HongKongHero() {
  return (
    <section className="relative isolate flex size-full min-h-[480px] flex-col items-center justify-center gap-5 overflow-hidden bg-[#060818] px-6 py-16 text-center text-white">
      <HongKong intensity={0.65} className="absolute inset-0 -z-10" />
      <h3 className="[text-shadow:0_1px_12px_rgb(6_8_24)] max-w-xl text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
        Last junk to Central
      </h3>
      <p className="[text-shadow:0_1px_12px_rgb(6_8_24)] max-w-md text-sm text-pretty text-white/90 sm:text-base">
        Victoria Harbour at blue hour in coloured dots, calm enough to sit
        behind your headline.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#get-started"
          className="rounded-full bg-[#fcb442] px-5 py-2.5 text-sm font-medium text-[#1a1203] transition-colors hover:bg-[#ffc560]"
        >
          Get started
        </a>
        <a
          href="#docs"
          className="rounded-full border border-white/25 bg-black/30 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/45"
        >
          Read the docs
        </a>
      </div>
    </section>
  );
}
