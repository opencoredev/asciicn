import { Ember } from "@/components/asciicn/ember";

export default function EmberHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-16 text-center">
      <Ember
        intensity={0.6}
        sparks={0.35}
        speed={0.8}
        className="absolute inset-0 -z-10"
      />
      <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
        Winter retreat
      </p>
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance">
        Three nights in the cabin, no laptops
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        An intensity of 0.6 keeps the fire in the lower third, under the text.
      </p>
    </section>
  );
}
