"use client";

import { GlyphRain } from "@/components/asciicn/glyph-rain";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/glyph-rain-controls";

export default function GlyphRainDemo() {
  const message = usePreviewValue(knobs.message);
  return (
    <GlyphRain
      message={message === "none" ? undefined : message}
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      density={usePreviewValue(knobs.density)}
      speed={usePreviewValue(knobs.speed)}
      hold={usePreviewValue(knobs.hold)}
      loop={usePreviewValue(knobs.loop)}
      cell={usePreviewValue(knobs.cell)}
      className="absolute inset-0"
    />
  );
}
