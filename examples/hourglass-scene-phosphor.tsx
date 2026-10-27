import { HourglassScene } from "@/components/asciicn/scenes/hourglass-scene";

export default function HourglassScenePhosphor() {
  return (
    <HourglassScene
      charset="standard"
      colorMode="mono"
      phosphor="p1"
      finish="ebony"
      fill={0.45}
      duration={10}
      fx={{ bloom: 0.35, scanlines: 0.35, vignette: 0.3 }}
      className="absolute inset-0"
    />
  );
}
