import { SanFrancisco } from "@/components/asciicn/san-francisco";
import { Button } from "@/components/ui/button";

// The bridge full-bleed behind a centred headline. The scene paints its own
// dusk in both themes, so the copy on top stays light.
export default function SanFranciscoHero() {
  return (
    <section className="relative isolate flex size-full min-h-[480px] flex-col items-center justify-start gap-4 overflow-hidden px-6 pt-[14vh] text-center text-white sm:justify-center sm:pt-0">
      <SanFrancisco intensity={0.7} className="absolute inset-0 -z-10" />
      <p className="font-mono text-xs tracking-[0.3em] text-white/70 uppercase">
        San Francisco
      </p>
      <h3 className="max-w-xl text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
        Ship before the fog lifts
      </h3>
      <p className="max-w-md text-sm text-pretty text-white/75">
        A blue-hour backdrop for your launch page, drawn in halftone dots.
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          className="bg-white text-neutral-950 hover:bg-white/90"
        >
          Get started
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
        >
          Read the docs
        </Button>
      </div>
    </section>
  );
}
