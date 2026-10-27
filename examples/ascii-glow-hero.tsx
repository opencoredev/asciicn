import { AsciiButton } from "@/components/asciicn/ascii-button";
import { AsciiGlow } from "@/components/asciicn/ascii-glow";

export default function AsciiGlowHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-center gap-5 overflow-hidden px-6 text-center">
      <AsciiGlow
        position="bottom"
        radius={0.85}
        charset="braille"
        color="purple"
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-lg font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
        Light, in characters
      </h3>
      <p className="max-w-md text-sm text-balance text-muted-foreground">
        A braille glow rising from the bottom edge, drifting a little every
        second.
      </p>
      <AsciiButton color="purple">Get started</AsciiButton>
    </section>
  );
}
