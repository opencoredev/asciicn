import { GlyphRain } from "@/components/asciicn/glyph-rain";

export default function GlyphRainAmbient() {
  return (
    <section className="relative isolate flex h-[380px] w-full items-center justify-center overflow-hidden px-6">
      <GlyphRain
        charset="braille"
        density={0.35}
        speed={0.7}
        className="absolute inset-0 -z-10"
      />
      <div className="max-w-sm rounded-2xl border bg-card/90 px-7 py-6 text-center backdrop-blur-sm">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
          Night shift
        </p>
        <h3 className="mt-2 text-balance font-medium text-2xl tracking-tight">
          Deploys keep running while you sleep
        </h3>
      </div>
    </section>
  );
}
