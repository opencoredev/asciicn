import { RedwoodLight } from "@/components/asciicn/redwood-light";

// Full bleed behind a centred headline and two buttons, dimmed so the copy reads first.
export default function RedwoodLightHero() {
  return (
    <section className="relative isolate flex size-full min-h-[520px] flex-col items-center justify-center gap-4 px-6 text-center">
      <RedwoodLight intensity={0.6} className="absolute inset-0 -z-10" />
      <h3 className="max-w-xl text-4xl font-medium tracking-[-0.03em] text-balance text-white sm:text-5xl">
        Grow something that lasts
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/80 [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">
        At 0.6 intensity the forest falls back and the light stays.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#get-started"
          className="rounded-md bg-[#fcb442] px-4 py-2 text-sm font-medium text-black"
        >
          Get started
        </a>
        <a
          href="#learn-more"
          className="rounded-md border border-white/30 bg-black/30 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
        >
          Learn more
        </a>
      </div>
    </section>
  );
}
