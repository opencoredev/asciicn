import { AsciiGlow } from "@/components/asciicn/ascii-glow";

export default function AsciiGlowCorner() {
  return (
    <div className="relative isolate w-full max-w-md overflow-hidden rounded-lg border p-6">
      <AsciiGlow
        position="top-right"
        radius={0.6}
        intensity={0.75}
        charset="katakana"
        color="green"
        className="absolute inset-0 -z-10"
      />
      <p className="font-mono text-xs text-muted-foreground">
        uptime · 90 days
      </p>
      <p className="mt-2 font-display text-4xl font-bold">99.98%</p>
    </div>
  );
}
