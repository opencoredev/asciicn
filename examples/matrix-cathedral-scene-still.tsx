import { MatrixCathedralScene } from "@/components/asciicn/scenes/matrix-cathedral-scene";

export default function MatrixCathedralSceneStill() {
  return (
    <MatrixCathedralScene
      animate={false}
      stillTime={12}
      colorMode="duotone"
      ramp="glacier"
      fog={1.4}
      fx={{}}
      className="absolute inset-0"
    />
  );
}
