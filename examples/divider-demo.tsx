"use client";

import { Divider } from "@/components/asciicn/divider";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/divider-controls";

export default function DividerDemo() {
  const variant = usePreviewValue(knobs.variant);
  const align = usePreviewValue(knobs.align);
  const showLabel = usePreviewValue(knobs.showLabel);
  const color = usePreviewValue(knobs.tint);

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Release notes</span>
        <p className="text-muted-foreground text-sm">
          Glyph cells now snap to whole device pixels, so every rule and box
          joins cleanly on any screen.
        </p>
      </div>
      <Divider
        variant={variant}
        align={align}
        color={color}
        label={showLabel ? "v0.4.0" : undefined}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Breaking changes</span>
        <p className="text-muted-foreground text-sm">
          None. Components built on 0.3 keep working without edits.
        </p>
      </div>
    </div>
  );
}
