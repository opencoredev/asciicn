"use client";

import { AsciiOrb } from "@/components/asciicn/ascii-orb";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-orb-controls";

export default function AsciiOrbDemo() {
  const state = usePreviewValue(knobs.state);
  const audio = usePreviewValue(knobs.audio);
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const morph = usePreviewValue(knobs.morph);
  const cell = usePreviewValue(knobs.cell);

  return (
    <AsciiOrb
      state={state}
      audio={audio === "none" ? null : audio}
      charset={charset}
      colorMode={colorMode}
      morph={morph}
      cell={cell}
      className="absolute inset-0"
    />
  );
}
