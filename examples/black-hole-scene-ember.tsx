import { BlackHoleScene } from "@/components/asciicn/scenes/black-hole-scene";

export default function BlackHoleSceneEmber() {
  return (
    <BlackHoleScene
      charset="dense"
      colorMode="duotone"
      ramp="ember"
      tilt={14}
      spin={1.6}
      className="absolute inset-0"
    />
  );
}
