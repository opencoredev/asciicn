import { OrreryScene } from "@/components/asciicn/scenes/orrery-scene";

export default function OrrerySceneEdge() {
  return (
    <OrreryScene
      charset="edge"
      tilt={0.35}
      glow={0.6}
      className="absolute inset-0"
    />
  );
}
