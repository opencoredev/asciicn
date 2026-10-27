import { SynthwaveSun } from "@/components/asciicn/synthwave-sun";

export default function SynthwaveSunHero() {
  return (
    <section className="relative isolate flex h-[420px] w-full items-start justify-center overflow-hidden pt-12">
      <SynthwaveSun
        mountains={0.6}
        travel={0.7}
        className="absolute inset-0 -z-10"
      />
      <div className="text-center font-mono">
        <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
          Side A
        </p>
        <h3 className="mt-2 text-3xl font-semibold tracking-tight">
          Night drive
        </h3>
      </div>
    </section>
  );
}
