import { CampfireWoodsScene } from "@/components/asciicn/scenes/campfire-woods-scene";
import { CRT_FX } from "@/lib/ascii";

export default function CampfireWoodsSceneAmber() {
  return (
    <CampfireWoodsScene
      charset="blocks"
      phosphor="p3"
      flame={1.3}
      fx={CRT_FX}
      cell={14}
      className="absolute inset-0"
    />
  );
}
