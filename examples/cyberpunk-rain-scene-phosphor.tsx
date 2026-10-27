import { CyberpunkRainScene } from "@/components/asciicn/scenes/cyberpunk-rain-scene";

export default function CyberpunkRainScenePhosphor() {
  return (
    <CyberpunkRainScene
      charset="katakana"
      phosphor="p1"
      wind={-0.5}
      signs={0.9}
      className="absolute inset-0"
    />
  );
}
