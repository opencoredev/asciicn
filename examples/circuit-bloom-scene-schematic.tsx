import { CircuitBloomScene } from "@/components/asciicn/scenes/circuit-bloom-scene";

export default function CircuitBloomSceneSchematic() {
  return (
    <CircuitBloomScene
      charset="standard"
      colorMode="mono"
      density={1.5}
      traffic={0.6}
      fx={{}}
      className="absolute inset-0"
    />
  );
}
