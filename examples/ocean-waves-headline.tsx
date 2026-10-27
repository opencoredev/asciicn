import { OceanWaves } from "@/components/asciicn/ocean-waves";

// The sea behind a headline, dimmed so the text on top stays readable.
export default function OceanWavesHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center">
      <OceanWaves
        intensity={0.5}
        swell={0.4}
        wind={0.2}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Calm water, steady hands
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        Lower the intensity and the swell, and the sea settles behind your copy.
      </p>
    </section>
  );
}
