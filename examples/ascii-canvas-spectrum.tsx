import { AsciiCanvas } from "@/components/asciicn/ascii-canvas";

export default function AsciiCanvasSpectrum() {
  return (
    <AsciiCanvas
      charset="braille"
      inks={["blue", "purple", "pink", "orange", "green"]}
      brushSize={1.2}
      decay={3.2}
      swirl={0.6}
      cell={10}
      className="h-80 w-full max-w-2xl"
    />
  );
}
