import { SanFrancisco } from "@/components/asciicn/san-francisco";

// The scene behind a headline, dimmed so the text on top stays readable.
export default function SanFranciscoHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center">
      <SanFrancisco intensity={0.55} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Ship before the fog lifts
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        Lower the intensity and the bridge, fog and bay fall back behind your
        copy.
      </p>
    </section>
  );
}
