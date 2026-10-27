"use client";

import { AsciiPortrait } from "@/components/asciicn/ascii-portrait";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-portrait-controls";

export default function AsciiPortraitDemo() {
  const photo = knobs.PORTRAITS[usePreviewValue(knobs.photo)];
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const cell = usePreviewValue(knobs.cell);
  const detail = usePreviewValue(knobs.detail);
  const edges = usePreviewValue(knobs.edges);
  const compare = usePreviewValue(knobs.compare);

  return (
    <AsciiPortrait
      src={photo.src}
      alt={photo.alt}
      charset={charset}
      colorMode={colorMode}
      ramp="sodium"
      cell={cell}
      detail={detail}
      edges={edges}
      compare={compare}
      className="aspect-[4/5] w-full max-w-[420px]"
    />
  );
}
