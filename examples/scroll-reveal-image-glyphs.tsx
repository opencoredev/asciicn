import { ScrollRevealImage } from "@/components/asciicn/scroll-reveal-image";

const STAGES = [
  { cell: 24, charset: "dots" },
  { cell: 16, charset: "katakana" },
  { cell: 11, charset: "dense" },
  { cell: 8, charset: "braille" },
] as const;

export default function ScrollRevealImageGlyphs() {
  return (
    <ScrollRevealImage
      src="/examples/pillars.jpg"
      alt="The Pillars of Creation, resolving from halftone dots to fine Braille"
      to="glyphs"
      stages={STAGES}
      colorMode="duotone"
      ramp="orchid"
      distance={1}
      className="aspect-[4/5] w-full max-w-sm"
    />
  );
}
