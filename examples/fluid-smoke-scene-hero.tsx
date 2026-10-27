import { FluidSmokeScene } from "@/components/asciicn/scenes/fluid-smoke-scene";

export default function FluidSmokeSceneHero() {
  return (
    <div className="absolute inset-0 isolate">
      <FluidSmokeScene
        colorMode="duotone"
        ramp="ember"
        emitter={0.72}
        buoyancy={1.4}
        className="absolute inset-0 -z-10"
      />
      <div className="pointer-events-none flex flex-col gap-2 p-6 font-mono sm:p-8">
        <p className="text-xs text-[#ffd35c] uppercase tracking-widest">
          drag to stir · press for a puff
        </p>
        <h2 className="max-w-md font-semibold text-2xl sm:text-3xl text-[#fff6d8]">
          Smoke you can push around
        </h2>
      </div>
    </div>
  );
}
