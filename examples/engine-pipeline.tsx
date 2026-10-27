"use client";

import { useState } from "react";

import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/engine-pipeline-controls";
import { createPlanetDraw } from "@/examples/engine-scene";
import { AsciiGrid } from "@/lib/ascii";

// One field of tones, mapped to glyphs on the CPU with `mapTones` and
// painted by `AsciiGrid`. Every knob changes only the mapping.
export default function EnginePipeline() {
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const dither = usePreviewValue(knobs.dither);
  const invert = usePreviewValue(knobs.invert);
  const [draw] = useState(createPlanetDraw);

  return (
    <AsciiGrid
      className="absolute inset-0"
      cell={12}
      colored={colorMode !== "mono"}
      draw={(context) =>
        draw(context, {
          charset,
          colorMode,
          dither: dither ? "bayer4" : "none",
          invert,
          palette: [
            [40, 40, 60],
            [120, 140, 255],
            [255, 240, 200],
          ],
        })
      }
    />
  );
}
