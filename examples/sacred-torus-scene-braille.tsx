import { SacredTorusScene } from "@/components/asciicn/scenes/sacred-torus-scene";

export default function SacredTorusSceneBraille() {
  return (
    <SacredTorusScene
      charset="braille"
      colorMode="duotone"
      ramp="vapor"
      tube={0.16}
      className="absolute inset-0"
    />
  );
}
