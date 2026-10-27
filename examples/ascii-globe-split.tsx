import { AsciiGlobe } from "@/components/asciicn/ascii-globe";
import { OFFICES, ROUTES } from "@/examples/dot-map-data";

export default function AsciiGlobeSplit() {
  return (
    <section className="grid w-full items-center gap-6 p-6 sm:grid-cols-2 sm:p-10">
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Network
        </span>
        <h3 className="text-2xl font-medium tracking-[-0.03em] text-balance">
          Eight offices, one on-call rotation
        </h3>
        <p className="text-muted-foreground text-sm text-pretty">
          Drag the globe to spin it. Arcs show the handoffs as the day moves
          west.
        </p>
      </div>
      <AsciiGlobe
        markers={OFFICES}
        arcs={ROUTES}
        color="purple"
        accent="pink"
        light={320}
        className="aspect-square w-full max-w-sm justify-self-center"
      />
    </section>
  );
}
