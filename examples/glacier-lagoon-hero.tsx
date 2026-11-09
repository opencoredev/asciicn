import { GlacierLagoon } from "@/components/asciicn/glacier-lagoon";

export default function GlacierLagoonHero() {
  return (
    <section className="relative isolate flex size-full min-h-[480px] flex-col items-center justify-center gap-4 overflow-hidden bg-[#0a0b1c] px-6 text-center text-white">
      <GlacierLagoon intensity={0.7} className="absolute inset-0 -z-10" />
      <h3 className="max-w-xl text-3xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
        Ship before the ice moves
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/75">
        At 0.7 intensity the middle of the lagoon quiets down, so the headline
        reads first.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#start"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-[#0a0b1c] transition-colors hover:bg-white/85"
        >
          Get started
        </a>
        <a
          href="#docs"
          className="rounded-md border border-white/30 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15"
        >
          Read the docs
        </a>
      </div>
    </section>
  );
}
