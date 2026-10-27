"use client";

import { AsciiText } from "@/components/asciicn/ascii-text";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-text-controls";

export default function AsciiTextDemo() {
  const charset = usePreviewValue(knobs.charset);
  const reveal = usePreviewValue(knobs.reveal);
  const cell = usePreviewValue(knobs.cell);
  const size = usePreviewValue(knobs.size);

  return (
    <AsciiText
      as="h3"
      charset={charset}
      reveal={reveal}
      trigger="mount"
      cell={cell}
      size={size}
      className="w-full font-display font-bold"
    >
      asciicn
    </AsciiText>
  );
}
