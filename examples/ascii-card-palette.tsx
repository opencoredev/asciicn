import { AsciiCard } from "@/components/asciicn/ascii-card";

export default function AsciiCardPalette() {
  return (
    <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
      <AsciiCard
        glow="bottom-right"
        color="green"
        matrix="blue-noise"
        strength={0.6}
        reach={240}
        cell={2}
        className="bg-background min-h-56 px-6"
      >
        <span className="font-semibold tracking-tight">
          Green, blue noise, 2px cells
        </span>
        <span className="text-muted-foreground -mt-4 text-sm">
          A finer grain for denser layouts.
        </span>
      </AsciiCard>
      <AsciiCard
        glow="bottom"
        color="orange"
        fill="hatched"
        reach={170}
        className="bg-background min-h-56 px-6"
      >
        <span className="font-semibold tracking-tight">Orange, hatched</span>
        <span className="text-muted-foreground -mt-4 text-sm">
          Diagonal lines that build up towards the edge.
        </span>
      </AsciiCard>
    </div>
  );
}
