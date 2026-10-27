"use client";

import { AsciiGlobe } from "@/components/asciicn/ascii-globe";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-globe-controls";
import { LINKS, REGIONS } from "@/examples/ascii-globe-data";

export default function AsciiGlobeDemo() {
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const speed = usePreviewValue(knobs.speed);
  const light = usePreviewValue(knobs.light);
  const cell = usePreviewValue(knobs.cell);
  const arcs = usePreviewValue(knobs.arcs);
  const graticule = usePreviewValue(knobs.graticule);

  return (
    <AsciiGlobe
      charset={charset}
      colorMode={colorMode}
      speed={speed}
      light={light}
      cell={cell}
      graticule={graticule}
      markers={REGIONS}
      arcs={arcs ? LINKS : undefined}
      className="absolute inset-0"
    />
  );
}
