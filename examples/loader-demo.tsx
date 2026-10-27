"use client";

import { Loader } from "@/components/asciicn/loader";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/loader-controls";

export default function LoaderDemo() {
  const variant = usePreviewValue(knobs.variant);
  const spinner = usePreviewValue(knobs.spinner);
  const size = usePreviewValue(knobs.size);
  const color = usePreviewValue(knobs.tint);
  const speed = usePreviewValue(knobs.speed);

  return (
    <div className="flex flex-col items-center gap-5">
      <Loader
        variant={variant}
        spinner={spinner}
        size={size}
        color={color}
        speed={speed}
        label="Loading preview"
      />
      <span className="text-muted-foreground font-mono text-xs">
        {variant === "spinner" ? `spinner · ${spinner}` : variant}
      </span>
    </div>
  );
}
