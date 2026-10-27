import { Nebula } from "@/components/asciicn/nebula";

export default function NebulaHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Nebula
        seed="lantern"
        intensity={0.55}
        speed={0.6}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance">
        Mission control for deep space
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        An intensity of 0.55 keeps the gas in the lighter half of the ramp.
      </p>
    </section>
  );
}
