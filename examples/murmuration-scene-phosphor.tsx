import { MurmurationScene } from "@/components/asciicn/scenes/murmuration-scene";
import { CRT_FX } from "@/lib/ascii";

export default function MurmurationScenePhosphor() {
  return (
    <MurmurationScene
      charset="quadrants"
      colorMode="mono"
      phosphor="p3"
      birds={1800}
      cohesion={1.8}
      fold={2}
      horizon="none"
      fx={CRT_FX}
      className="absolute inset-0"
    />
  );
}
