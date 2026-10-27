import { AsciiGlow } from "@/components/asciicn/ascii-glow";

export default function AsciiGlowPalette() {
  return (
    <AsciiGlow
      position={[0.3, 0.35]}
      radius={0.55}
      intensity={1}
      palette={[
        "--ascii-paper",
        "color-mix(in oklch, var(--ascii-ink) 30%, var(--ascii-paper))",
        "oklch(0.6 0.2 305)",
        "--ascii-ink",
        "color-mix(in oklch, var(--ascii-ink) 45%, var(--foreground))",
      ]}
      cell={4}
      className="absolute inset-0"
    />
  );
}
