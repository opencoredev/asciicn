import { AsciiGlow } from "@/components/asciicn/ascii-glow";

const GLOWS = [
  { charset: "blocks", color: "orange", point: [0.2, 0.8] },
  { charset: "dots", color: "blue", point: [0.5, 0.2] },
  { charset: "dense", color: "pink", point: [0.8, 0.7] },
] as const;

export default function AsciiGlowPalette() {
  return (
    <div className="grid size-full grid-cols-1 sm:grid-cols-3">
      {GLOWS.map((glow) => (
        <div key={glow.charset} className="relative min-h-40 overflow-hidden">
          <AsciiGlow
            position={glow.point}
            radius={0.55}
            charset={glow.charset}
            color={glow.color}
            className="absolute inset-0"
          />
          <span className="absolute bottom-3 left-4 font-mono text-xs text-muted-foreground">
            {glow.charset}
          </span>
        </div>
      ))}
    </div>
  );
}
