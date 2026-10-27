import { Starfield } from "@/components/asciicn/starfield";

export default function StarfieldStill() {
  return (
    <Starfield
      animate={false}
      density={1.6}
      haze={0.9}
      charset="braille"
      colorMode="mono"
      phosphor="ibm"
      className="absolute inset-0"
    />
  );
}
