import { MorphogenesisScene } from "@/components/asciicn/scenes/morphogenesis-scene";

export default function MorphogenesisSceneLabyrinth() {
  return (
    <MorphogenesisScene
      pattern="labyrinth"
      charset="blocks"
      colorMode="mono"
      fx={{}}
      className="absolute inset-0"
    />
  );
}
