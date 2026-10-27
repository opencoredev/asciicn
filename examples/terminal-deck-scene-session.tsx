import { TerminalDeckScene } from "@/components/asciicn/scenes/terminal-deck-scene";
import type { DeckCommand } from "@/components/asciicn/scenes/terminal-deck-scene";

const SESSION: DeckCommand[] = [
  {
    command: "pnpm dlx shadcn add @asciicn/terminal-deck-scene",
    output: ["✔ Checking registry.", "✔ Installing files.", "Done."],
  },
  {
    command: "pnpm dev",
    output: ["ready on http://localhost:3000", "compiled in 412 ms"],
  },
  {
    command: "git push",
    output: ["main -> main", "deploy queued"],
  },
];

export default function TerminalDeckSceneSession() {
  return (
    <TerminalDeckScene
      hostname="studio"
      script={SESSION}
      frame="light"
      colorMode="ansi16"
      ansi="xterm"
      fx={{}}
      className="absolute inset-0"
    />
  );
}
