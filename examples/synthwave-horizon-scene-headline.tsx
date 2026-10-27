import { SynthwaveHorizonScene } from "@/components/asciicn/scenes/synthwave-horizon-scene";
import { CRT_FX } from "@/lib/ascii";

export default function SynthwaveHorizonSceneHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-2 overflow-hidden px-6 pt-10 text-center text-white">
      <SynthwaveHorizonScene
        fx={CRT_FX}
        travel={0.6}
        className="absolute inset-0 -z-10"
      />
      <p className="font-mono text-xs tracking-[0.25em] text-pink-300 uppercase">
        Side B
      </p>
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance [text-shadow:0_2px_16px_rgb(0_0_0/0.8)] sm:text-4xl">
        Drive into the release notes
      </h3>
    </section>
  );
}
