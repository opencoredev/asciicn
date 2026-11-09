import { BalloonValley } from "@/components/asciicn/balloon-valley";

// Full-bleed behind a centred headline and two buttons. The scene prints on
// cream paper, so the type is a dark slate blue taken from its hills.
export default function BalloonValleyHero() {
  return (
    <section className="relative isolate flex min-h-[560px] w-full flex-col items-center justify-center gap-5 overflow-hidden px-6 py-24 text-center">
      <BalloonValley className="absolute inset-0 -z-10" />
      {/* A soft wash of the paper behind the text only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_36%_22%_at_50%_46%,rgb(246_239_230/0.7),transparent)]"
      />
      <h1 className="max-w-2xl text-4xl font-medium tracking-[-0.03em] text-balance text-[#1f2a44] sm:text-6xl">
        Up before the sun
      </h1>
      <p className="max-w-md text-base text-pretty text-[#1f2a44]/75">
        Dawn flights over the river valley, every morning the wind allows.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#book"
          className="rounded-md bg-[#1f2a44] px-4 py-2 text-sm font-medium text-[#f6efe6] shadow-sm"
        >
          Book a flight
        </a>
        <a
          href="#routes"
          className="rounded-md border border-[#1f2a44]/25 bg-[#f6efe6]/70 px-4 py-2 text-sm font-medium text-[#1f2a44] backdrop-blur-sm"
        >
          See the routes
        </a>
      </div>
    </section>
  );
}
