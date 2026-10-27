import { MorphogenesisScene } from "@/components/asciicn/scenes/morphogenesis-scene";

export default function MorphogenesisSceneSpecimen() {
  return (
    <MorphogenesisScene
      pattern="spots"
      charset="standard"
      colorMode="mono"
      phosphor="p3"
      growth={1.6}
      fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.5 }}
      className="absolute inset-0"
    />
  );
}
