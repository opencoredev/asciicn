import { HourglassScene } from "@/components/asciicn/scenes/hourglass-scene";

export default function HourglassSceneBraille() {
  return (
    <HourglassScene
      charset="braille"
      finish="brass"
      duration={14}
      sand={["#f4e2b8", "#e7b765", "#d0874a", "#9c5a34"]}
      className="absolute inset-0"
    />
  );
}
