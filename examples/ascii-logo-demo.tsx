"use client";

import { AsciiLogo } from "@/components/asciicn/ascii-logo";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-logo-controls";
import { LOGOS } from "@/examples/ascii-logo-data";

export default function AsciiLogoDemo() {
  const name = usePreviewValue(knobs.logo);
  const charset = usePreviewValue(knobs.charset);
  const effect = usePreviewValue(knobs.effect);
  const color = usePreviewValue(knobs.ink);
  const colorMode = usePreviewValue(knobs.colorMode);
  const cell = usePreviewValue(knobs.cell);
  const logo = LOGOS.find((item) => item.alt === name) ?? LOGOS[0];

  return (
    <AsciiLogo
      // Remount on a new logo or effect so one-shot effects play again.
      key={`${logo.src}-${effect}`}
      src={logo.src}
      alt={logo.alt}
      ratio={logo.ratio}
      charset={charset}
      effect={effect}
      color={color}
      colorMode={colorMode}
      ramp="glacier"
      cell={cell}
      className="w-full max-w-2xl"
    />
  );
}
