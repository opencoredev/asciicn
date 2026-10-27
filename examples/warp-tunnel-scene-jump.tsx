import { WarpTunnelScene } from "@/components/asciicn/scenes/warp-tunnel-scene";

export default function WarpTunnelSceneJump() {
  return (
    <WarpTunnelScene
      charset="braille"
      velocity={2.4}
      streak={2.2}
      twist={1.1}
      density={1.4}
      className="absolute inset-0"
    />
  );
}
