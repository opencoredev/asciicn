import { MurmurationScene } from "@/components/asciicn/scenes/murmuration-scene";

export default function MurmurationSceneInk() {
  return (
    <MurmurationScene
      charset="dense"
      colorMode="mono"
      birds={4500}
      horizon="trees"
      fx={{}}
      className="absolute inset-0"
    />
  );
}
