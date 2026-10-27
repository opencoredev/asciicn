import { Waves } from "@/components/asciicn/waves";

export default function WavesLines() {
  return (
    <Waves
      variant="lines"
      layers={5}
      amplitude={1.2}
      colorMode="mono"
      phosphor="blueprint"
      className="absolute inset-0"
    />
  );
}
