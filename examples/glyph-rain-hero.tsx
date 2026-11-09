import { GlyphRain } from "@/components/asciicn/glyph-rain";
import { Button } from "@/components/ui/button";

export default function GlyphRainHero() {
  return (
    <section className="flex w-full flex-col items-center gap-5 text-center">
      <div className="relative h-56 w-full sm:h-72">
        <GlyphRain message="v1.0" hold={6} className="absolute inset-0" />
      </div>
      <h3 className="sr-only">Version 1.0</h3>
      <p className="max-w-md text-pretty text-muted-foreground text-sm">
        Faster builds, a smaller runtime and a new plugin API. Upgrading takes
        one command.
      </p>
      <div className="flex gap-2">
        <Button size="sm">Read the notes</Button>
        <Button size="sm" variant="outline">
          Changelog
        </Button>
      </div>
    </section>
  );
}
