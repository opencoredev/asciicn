import { TempestStormScene } from "@/components/asciicn/scenes/tempest-storm-scene";
import { CRT_FX } from "@/lib/ascii";

export default function TempestStormSceneCrt() {
  return (
    <TempestStormScene
      charset="dense"
      phosphor="p1"
      fx={CRT_FX}
      strikes={1.6}
      className="absolute inset-0"
    />
  );
}
