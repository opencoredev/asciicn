"use client";

import { RetroComputer } from "@/components/asciicn/retro-computer";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/retro-computer-controls";

export default function RetroComputerDemo() {
  return (
    <RetroComputer
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      screen={usePreviewValue(knobs.screen)}
      typing={usePreviewValue(knobs.typing)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
