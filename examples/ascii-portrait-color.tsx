import { AsciiPortrait } from "@/components/asciicn/ascii-portrait";

export default function AsciiPortraitColor() {
  return (
    <AsciiPortrait
      src="/examples/ride.jpg"
      alt="Astronaut Sally Ride in 1984, smiling, in a navy NASA shirt"
      colorMode="truecolor"
      grade={{ brightness: 0.1, contrast: 1.1, saturation: 1.4 }}
      edges={false}
      compare="drag"
      cell={6}
      className="aspect-[4/5] w-full max-w-sm"
    />
  );
}
