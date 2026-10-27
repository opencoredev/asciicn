import { TempestStormScene } from "@/components/asciicn/scenes/tempest-storm-scene";

export default function TempestStormSceneSquall() {
  return (
    <TempestStormScene
      charset="quadrants"
      rain={2}
      wind={1.8}
      strikes={2.5}
      className="absolute inset-0"
    />
  );
}
