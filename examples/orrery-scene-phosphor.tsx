import { OrreryScene } from "@/components/asciicn/scenes/orrery-scene";
import { CRT_FX } from "@/lib/ascii";

export default function OrreryScenePhosphor() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-end gap-2 overflow-hidden p-6 text-left sm:p-10">
      <OrreryScene
        phosphor="p3"
        fx={CRT_FX}
        tilt={0.7}
        speed={0.6}
        className="absolute inset-0 -z-10"
      />
      <p className="font-mono text-xs tracking-[0.25em] text-[#ffb000] uppercase">
        Release 4.2
      </p>
      <h3 className="max-w-sm text-3xl font-medium tracking-[-0.03em] text-balance text-[#ffe2a3] [text-shadow:0_2px_16px_rgb(0_0_0/0.9)] sm:text-4xl">
        Every part turns on time
      </h3>
    </section>
  );
}
