import { GlitchText } from "@/components/asciicn/glitch-text";

export default function GlitchTextMeltdown() {
  return (
    <div className="flex max-w-2xl flex-col items-start gap-2 font-mono">
      <GlitchText
        as="p"
        intensity={0.5}
        interval={1.5}
        split={["orange", "purple"]}
        className="text-xs tracking-widest text-muted-foreground uppercase"
      >
        kernel panic · core 3
      </GlitchText>
      <GlitchText
        as="h3"
        glyphs="blocks"
        intensity={1}
        interval={1.2}
        duration={0.6}
        className="text-3xl font-bold tracking-tight sm:text-5xl"
      >
        SEGMENT 0x7F3A CORRUPTED
      </GlitchText>
    </div>
  );
}
