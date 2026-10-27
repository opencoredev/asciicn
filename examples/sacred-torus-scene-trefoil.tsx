import { SacredTorusScene } from "@/components/asciicn/scenes/sacred-torus-scene";

export default function SacredTorusSceneTrefoil() {
  return (
    <SacredTorusScene
      knots={[[2, 3]]}
      charset="dense"
      colorMode="mono"
      solids={false}
      sigil={false}
      background="transparent"
      fx={{}}
      className="absolute inset-0"
    />
  );
}
