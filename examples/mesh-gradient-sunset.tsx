import { MeshGradient } from "@/components/asciicn/mesh-gradient";

// Five warm blobs from violet to gold, in Dense 70 glyphs on small cells.
export default function MeshGradientSunset() {
  return (
    <MeshGradient
      blobs={5}
      size={0.5}
      charset="dense"
      cell={10}
      colors={[
        "oklch(0.5 0.18 300)",
        "oklch(0.62 0.21 350)",
        "oklch(0.7 0.19 25)",
        "oklch(0.78 0.15 55)",
        "oklch(0.9 0.11 85)",
      ]}
      className="absolute inset-0"
    />
  );
}
