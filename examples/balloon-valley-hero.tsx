import { BalloonValley } from "@/components/asciicn/balloon-valley";

// Full-bleed behind a centred headline and two buttons.
export default function BalloonValleyHero() {
  return (
    <section className="relative isolate flex min-h-[560px] w-full flex-col items-center justify-center gap-5 overflow-hidden px-6 py-24 text-center">
      <BalloonValley className="absolute inset-0 -z-10" />
      {/* A soft shade behind the text only, so the sun still glows round it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_36%_22%_at_50%_46%,rgb(13_11_31/0.5),transparent)]"
      />
      <h1 className="max-w-2xl text-4xl font-medium tracking-[-0.03em] text-balance text-white [text-shadow:0_2px_24px_rgb(13_11_31/0.8)] sm:text-6xl">
        Up before the sun
      </h1>
      <p className="max-w-md text-base text-pretty text-white/80 [text-shadow:0_1px_12px_rgb(13_11_31/0.9)]">
        Dawn flights over the river valley, every morning the wind allows.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#book"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-[#0d0b1f] shadow-sm"
        >
          Book a flight
        </a>
        <a
          href="#routes"
          className="rounded-md border border-white/40 bg-[#0d0b1f]/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
        >
          See the routes
        </a>
      </div>
    </section>
  );
}
