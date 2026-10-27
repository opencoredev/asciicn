import { Miami } from "@/components/asciicn/miami";

// The scene behind a headline, dimmed so the text on top stays readable.
export default function MiamiHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center">
      <Miami intensity={0.55} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Night on Ocean Drive
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        Lower the intensity and the hotels, palms and towers fall back behind
        your copy.
      </p>
    </section>
  );
}
