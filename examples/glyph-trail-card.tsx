import { GlyphTrail } from "@/components/asciicn/glyph-trail";

export default function GlyphTrailCard() {
  return (
    <GlyphTrail
      charset="braille"
      cell={12}
      spread={2.2}
      className="bg-card flex h-48 w-full max-w-sm flex-col justify-end overflow-hidden rounded-lg border p-5"
    >
      <span className="text-muted-foreground font-mono text-xs">~/drafts</span>
      <span className="mt-1 text-lg font-medium">Sketches, 14 files</span>
    </GlyphTrail>
  );
}
