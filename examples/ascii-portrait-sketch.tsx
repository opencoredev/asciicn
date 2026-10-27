import { AsciiPortrait } from "@/components/asciicn/ascii-portrait";

export default function AsciiPortraitSketch() {
  return (
    <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
      <AsciiPortrait
        src="/examples/lincoln.jpg"
        alt="Abraham Lincoln drawn in classic glyphs with contour strokes"
        charset="standard"
        invert
        detail={0.7}
        cell={9}
        compare="none"
        className="aspect-[4/5] w-full"
      />
      <AsciiPortrait
        src="/examples/lincoln.jpg"
        alt="Abraham Lincoln in Braille on amber phosphor glass"
        phosphor="p3"
        edgeThreshold={0.22}
        cell={7}
        compare="none"
        className="aspect-[4/5] w-full"
      />
    </div>
  );
}
