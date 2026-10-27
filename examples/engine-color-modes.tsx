"use client";

import { useState } from "react";

import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/engine-color-modes-controls";
import { createPlanetDraw } from "@/examples/engine-scene";
import { AsciiGrid, hexToRgb, PHOSPHORS } from "@/lib/ascii";

// Theme colours from paper to ink, for `palette` mode.
const PALETTE = ["#101018", "#3b4bd8", "#9f7aea", "#f6ad55", "#fffbea"].map(
  hexToRgb
);

// The planet in each colour mode. Mono draws on its phosphor's glass.
export default function EngineColorModes() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const ramp = usePreviewValue(knobs.ramp);
  const ansi = usePreviewValue(knobs.ansi);
  const [draw] = useState(createPlanetDraw);
  const mono = colorMode === "mono";

  return (
    <AsciiGrid
      className="absolute inset-0"
      cell={11}
      colored={!mono}
      ink={mono ? PHOSPHORS[phosphor].ink : "--ascii-ink"}
      paper={mono ? PHOSPHORS[phosphor].paper : "#07070b"}
      draw={(context) =>
        draw(context, {
          ansi,
          charset: "dense",
          colorMode,
          palette: PALETTE,
          ramp,
        })
      }
    />
  );
}
