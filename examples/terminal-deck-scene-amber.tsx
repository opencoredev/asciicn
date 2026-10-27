import { TerminalDeckScene } from "@/components/asciicn/scenes/terminal-deck-scene";

export default function TerminalDeckSceneAmber() {
  return (
    <TerminalDeckScene
      charset="quadrants"
      colorMode="mono"
      phosphor="p3"
      frame="double"
      fx={{ bloom: 0.6, curvature: 0.4, scanlines: 0.55, vignette: 0.5 }}
      className="absolute inset-0"
    />
  );
}
