import { AsciiReveal } from "@/components/asciicn/ascii-reveal";

export default function AsciiRevealRadial() {
  return (
    <AsciiReveal
      src="/examples/pillars.jpg"
      alt="The Pillars of Creation, towers of gas and dust in the Eagle Nebula"
      direction="radial"
      duration={3600}
      colorMode="truecolor"
      grade={{ gamma: 1.25, saturation: 1.25 }}
      cell={9}
      ratio={16 / 9}
      className="w-full"
    />
  );
}
