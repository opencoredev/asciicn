"use client";

import { AsciiImage } from "@/components/asciicn/ascii-image";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-image-controls";

export default function AsciiImageDemo() {
  const photo = knobs.PHOTOS[usePreviewValue(knobs.photo)];
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const cell = usePreviewValue(knobs.cell);
  const reveal = usePreviewValue(knobs.reveal);
  const autoLevels = usePreviewValue(knobs.autoLevels);

  return (
    <AsciiImage
      src={photo.src}
      alt={photo.alt}
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      reveal={reveal}
      autoLevels={autoLevels}
      className="w-full"
      // Fit the photo's own shape inside a stage about 520px tall.
      style={{ aspectRatio: photo.ratio, maxWidth: 520 * photo.ratio }}
    />
  );
}
