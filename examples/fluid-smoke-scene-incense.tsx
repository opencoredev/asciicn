import { FluidSmokeScene } from "@/components/asciicn/scenes/fluid-smoke-scene";

export default function FluidSmokeSceneIncense() {
  return (
    <FluidSmokeScene
      charset="dense"
      colorMode="mono"
      buoyancy={0.8}
      swirl={1.4}
      fade={1.4}
      emitter={0.3}
      fx={{}}
      className="absolute inset-0"
    />
  );
}
