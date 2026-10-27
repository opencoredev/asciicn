import { AsciiCanvas } from "@/components/asciicn/ascii-canvas";

export default function AsciiCanvasHero() {
  return (
    <section className="relative h-96 w-full max-w-3xl overflow-hidden border border-border">
      <AsciiCanvas
        chars=" .·:+x*X#"
        decay={1.2}
        clearButton={false}
        hint={false}
        aria-label="Decorative glyph pad behind the heading. Drag to paint."
        className="absolute inset-0"
      />
      {/* The copy lets pointer events through, so the pad under it still paints. */}
      <div className="pointer-events-none relative flex h-full flex-col items-start justify-end gap-2 p-8">
        <p className="font-mono text-muted-foreground text-xs">
          release 4.2 · out now
        </p>
        <h2 className="max-w-md text-balance font-semibold text-3xl text-foreground tracking-tight">
          Leave a mark on the page.
        </h2>
      </div>
    </section>
  );
}
