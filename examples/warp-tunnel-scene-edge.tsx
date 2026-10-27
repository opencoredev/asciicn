import { WarpTunnelScene } from "@/components/asciicn/scenes/warp-tunnel-scene";

export default function WarpTunnelSceneEdge() {
  return (
    <WarpTunnelScene
      charset="edge"
      phosphor="blueprint"
      streak={1.6}
      walls={0.4}
      className="absolute inset-0"
    />
  );
}
