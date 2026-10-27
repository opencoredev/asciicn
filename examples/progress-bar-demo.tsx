"use client";

import { useEffect, useState } from "react";

import { ProgressBar } from "@/components/asciicn/progress-bar";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/progress-bar-controls";

const STEPS = [
  "Resolving 214 packages",
  "Compiling glyph atlas",
  "Rendering static pages",
  "Uploading build output",
] as const;

export default function ProgressBarDemo() {
  const track = usePreviewValue(knobs.track);
  const color = usePreviewValue(knobs.tint);
  const size = usePreviewValue(knobs.size);
  const segments = usePreviewValue(knobs.segments);
  const indeterminate = usePreviewValue(knobs.indeterminate);
  const [progress, setProgress] = useState(37.5);

  useEffect(() => {
    // Uneven steps, so the eighth-block edge lands between whole cells.
    const timer = window.setInterval(() => {
      setProgress((value) => (value >= 100 ? 6 : Math.min(100, value + 7.3)));
    }, 1100);
    return () => window.clearInterval(timer);
  }, []);

  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(progress / 25))];

  return (
    <div className="bg-background border-border flex w-full max-w-md flex-col gap-5 rounded-lg border p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium">Deploying docs</span>
        <span className="text-muted-foreground font-mono text-xs">4f2a1c9</span>
      </div>
      <ProgressBar
        label={indeterminate ? "Waiting for a build runner" : step}
        value={indeterminate ? null : progress}
        track={track}
        color={color}
        size={size}
        segments={segments === 0 ? undefined : segments}
      />
    </div>
  );
}
