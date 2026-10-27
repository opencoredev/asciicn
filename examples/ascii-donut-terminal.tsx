import { AsciiDonut } from "@/components/asciicn/ascii-donut";

export default function AsciiDonutTerminal() {
  return (
    <div className="w-full max-w-md border bg-background font-mono text-xs">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-muted-foreground">
        <span>~/render $ ./ring --cp437</span>
        <span>p1</span>
      </div>
      <AsciiDonut
        charset="cp437"
        colorMode="mono"
        phosphor="p1"
        thickness={0.55}
        floor={false}
        fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.4 }}
        cell={11}
        className="aspect-square w-full"
      />
    </div>
  );
}
