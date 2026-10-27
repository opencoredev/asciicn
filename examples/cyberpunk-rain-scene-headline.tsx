import { CyberpunkRainScene } from "@/components/asciicn/scenes/cyberpunk-rain-scene";

export default function CyberpunkRainSceneHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col justify-end gap-3 overflow-hidden px-8 pb-12 text-white">
      <CyberpunkRainScene
        rain={0.85}
        fog={0.75}
        className="absolute inset-0 -z-20"
      />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-linear-to-t from-black/85 via-black/45 to-transparent" />
      <p className="font-mono text-xs tracking-[0.2em] text-fuchsia-300 uppercase">
        Night build · 02:14
      </p>
      <h3 className="max-w-lg text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Ship from anywhere, even in the rain
      </h3>
    </section>
  );
}
