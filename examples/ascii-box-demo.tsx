"use client";

import { AsciiBox } from "@/components/asciicn/ascii-box";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-box-controls";

export default function AsciiBoxDemo() {
  const frame = usePreviewValue(knobs.frame);
  const color = usePreviewValue(knobs.tint);
  const labelAlign = usePreviewValue(knobs.align);
  const shadow = usePreviewValue(knobs.shadow);
  const padding = usePreviewValue(knobs.padding);
  const filled = usePreviewValue(knobs.filled);

  return (
    <AsciiBox
      frame={frame}
      color={color}
      labelAlign={labelAlign}
      shadow={shadow === "none" ? false : shadow}
      padding={padding}
      filled={filled}
      title="build #4182"
      footer="exit 0"
      className="font-mono text-sm"
    >
      <p className="text-muted-foreground">
        <span className="text-foreground">✓</span> compiled 214 modules in 1.8s
      </p>
      <p className="text-muted-foreground">
        <span className="text-foreground">✓</span> 96 routes prerendered
      </p>
      <p className="text-muted-foreground">
        <span className="text-foreground">→</span> deployed to edge, 31 regions
      </p>
    </AsciiBox>
  );
}
