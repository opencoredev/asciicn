import { MountainDusk } from "@/components/asciicn/mountain-dusk";

// The scene behind a headline, dimmed so the text on top stays readable.
export default function MountainDuskHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center">
      <MountainDusk
        intensity={0.55}
        time={0.6}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Last light on the ridge
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        Lower the intensity and the ridges, mist and stars settle behind your
        copy.
      </p>
    </section>
  );
}
