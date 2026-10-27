import { Waves } from "@/components/asciicn/waves";

export default function WavesDusk() {
  return (
    <Waves
      horizon={0.55}
      layers={7}
      amplitude={1.3}
      speed={0.8}
      palette={[
        "--ascii-paper",
        "oklch(0.38 0.11 300)",
        "oklch(0.6 0.17 20)",
        "oklch(0.82 0.14 60)",
      ]}
      className="absolute inset-0"
    />
  );
}
