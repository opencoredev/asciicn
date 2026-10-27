"use client";

import { TerminalDeckScene } from "@/components/asciicn/scenes/terminal-deck-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/terminal-deck-scene-controls";

export default function TerminalDeckSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <TerminalDeckScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      frame={usePreviewValue(knobs.frame)}
      // undefined keeps the deck's own CRT finish; {} turns it off.
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
