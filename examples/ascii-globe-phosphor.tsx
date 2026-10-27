import { AsciiGlobe } from "@/components/asciicn/ascii-globe";
import { SAO_PAULO } from "@/examples/ascii-globe-data";

const MARKERS = [{ at: SAO_PAULO }];

export default function AsciiGlobePhosphor() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-1 overflow-hidden border bg-background p-5">
      <span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
        busiest region
      </span>
      <span className="font-semibold text-2xl tracking-tight">São Paulo</span>
      <span className="text-muted-foreground text-xs tabular-nums">
        18.2k requests per minute
      </span>
      <AsciiGlobe
        markers={MARKERS}
        start={-46}
        tilt={-30}
        speed={0}
        colorMode="mono"
        phosphor="p3"
        charset="dense"
        graticule
        cell={9}
        draggable={false}
        className="mt-3 aspect-square w-full"
      />
    </div>
  );
}
