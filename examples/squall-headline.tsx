import { Squall } from "@/components/asciicn/squall";

export default function SquallHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Squall
        seed="undertow"
        intensity={0.5}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance">
        Incidents, before they make landfall
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        Half intensity drops the bands to the light end of the ramp.
      </p>
    </section>
  );
}
