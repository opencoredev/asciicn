import { CoastalLighthouseScene } from "@/components/asciicn/scenes/coastal-lighthouse-scene";

export default function CoastalLighthouseScenePhosphor() {
  return (
    <CoastalLighthouseScene
      charset="blocks"
      phosphor="p3"
      storm={0.8}
      className="absolute inset-0"
    />
  );
}
