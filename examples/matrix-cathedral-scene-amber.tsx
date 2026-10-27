import { MatrixCathedralScene } from "@/components/asciicn/scenes/matrix-cathedral-scene";

export default function MatrixCathedralSceneAmber() {
  return (
    <MatrixCathedralScene
      charset="cp437"
      colorMode="mono"
      phosphor="p3"
      glide={0.2}
      density={0.85}
      className="absolute inset-0"
    />
  );
}
