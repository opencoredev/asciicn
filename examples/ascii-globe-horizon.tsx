import { AsciiGlobe } from "@/components/asciicn/ascii-globe";
import {
  LONDON,
  NEW_YORK,
  SINGAPORE,
  TOKYO,
} from "@/examples/ascii-globe-data";

const MARKERS = [LONDON, NEW_YORK, SINGAPORE, TOKYO].map((at) => ({ at }));
const ARCS = [
  { from: NEW_YORK, to: LONDON },
  { from: LONDON, to: SINGAPORE },
  { from: SINGAPORE, to: TOKYO },
];

export default function AsciiGlobeHorizon() {
  return (
    <section className="relative isolate flex size-full items-end justify-center overflow-hidden px-6 pb-8 text-center">
      <AsciiGlobe
        charset="standard"
        markers={MARKERS}
        arcs={ARCS}
        tilt={14}
        start={-20}
        speed={4}
        light={20}
        draggable={false}
        background="transparent"
        className="absolute -bottom-[80%] left-1/2 -z-10 aspect-square w-[150%] -translate-x-1/2 sm:-bottom-[95%] sm:w-[120%]"
      />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-linear-to-t from-background to-transparent" />
      <div className="mb-auto flex max-w-md flex-col items-center gap-3 pt-10">
        <h3 className="text-balance font-medium text-3xl tracking-[-0.03em]">
          Deploy once, serve every continent
        </h3>
        <p className="text-pretty text-muted-foreground text-sm">
          38 regions, one config file. Requests land on the nearest edge in
          under 50 ms.
        </p>
      </div>
    </section>
  );
}
