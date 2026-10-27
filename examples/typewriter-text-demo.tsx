"use client";

import { TypewriterText } from "@/components/asciicn/typewriter-text";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/typewriter-text-controls";

const PHRASES = [
  "npx shadcn add @asciicn/typewriter-text",
  "pnpm dev --port 3000",
  "git commit -m 'ship it in glyphs'",
] as const;

export default function TypewriterTextDemo() {
  const cursor = usePreviewValue(knobs.cursor);
  const speed = usePreviewValue(knobs.speed);
  const jitter = usePreviewValue(knobs.jitter);
  const prompt = usePreviewValue(knobs.prompt);
  const backspace = usePreviewValue(knobs.backspace);

  return (
    <div className="w-full max-w-xl font-mono text-sm sm:text-base">
      <TypewriterText
        as="p"
        phrases={PHRASES}
        cursor={cursor}
        speed={speed}
        jitter={jitter / 100}
        prompt={prompt ? "$ " : undefined}
        backspace={backspace}
        className="text-left"
      />
    </div>
  );
}
