import { CoastalLighthouseScene } from "@/components/asciicn/scenes/coastal-lighthouse-scene";

export default function CoastalLighthouseSceneCalm() {
  return (
    <CoastalLighthouseScene
      charset="dense"
      swell={0.35}
      storm={0}
      fog={0.4}
      beamSpeed={0.5}
      className="absolute inset-0"
    />
  );
}
