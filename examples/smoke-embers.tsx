import { Smoke } from "@/components/asciicn/smoke";

export default function SmokeEmbers() {
  return (
    <Smoke
      scale={1.4}
      height={0.65}
      wind={-0.4}
      charset="cp437"
      colorMode="truecolor"
      palette={[
        "--ascii-paper",
        "oklch(0.34 0.09 30)",
        "oklch(0.6 0.19 38)",
        "oklch(0.84 0.15 70)",
      ]}
      className="absolute inset-0"
    />
  );
}
