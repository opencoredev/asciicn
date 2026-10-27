import { CircuitBloomScene } from "@/components/asciicn/scenes/circuit-bloom-scene";

export default function CircuitBloomSceneHero() {
  return (
    <div className="absolute inset-0 isolate">
      <CircuitBloomScene
        board="navy"
        charset="dots"
        density={0.7}
        traffic={2}
        seed={21}
        className="absolute inset-0 -z-10"
      />
      <div className="pointer-events-none flex flex-col gap-2 p-6 font-mono sm:p-8">
        <p className="text-xs text-[#78e8ff] uppercase tracking-widest">
          hover to power a pin · click to drop a chip
        </p>
        <h2 className="max-w-md font-semibold text-2xl text-[#f4f6fb] sm:text-3xl">
          Hardware that routes itself
        </h2>
      </div>
    </div>
  );
}
