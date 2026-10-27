"use client";

import { ImageCompare } from "@/components/asciicn/image-compare";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/image-compare-controls";

export default function ImageCompareDemo() {
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const cell = usePreviewValue(knobs.cell);

  return (
    <ImageCompare
      src="/examples/earthrise.jpg"
      alt="Earthrise from Apollo 8, as glyphs on the left and the photo on the right"
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      className="aspect-[4/3] w-full max-w-2xl"
    />
  );
}
