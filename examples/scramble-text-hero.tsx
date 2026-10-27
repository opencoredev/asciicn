import { ScrambleText } from "@/components/asciicn/scramble-text";

export default function ScrambleTextHero() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ScrambleText
        as="p"
        glyphs="binary"
        trigger="mount"
        duration={0.3}
        color="green"
        className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
      >
        v2.0 now in beta
      </ScrambleText>
      <ScrambleText
        as="h3"
        glyphs="braille"
        trigger="mount"
        duration={0.7}
        stagger={0.04}
        className="font-display text-4xl leading-tight font-bold tracking-tight text-balance sm:text-6xl"
      >
        Every pixel, a character.
      </ScrambleText>
    </div>
  );
}
