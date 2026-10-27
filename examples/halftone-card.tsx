import { Halftone } from "@/components/asciicn/halftone";

export default function HalftoneCard() {
  return (
    <div className="bg-background relative isolate flex w-full max-w-xs flex-col gap-1 overflow-hidden rounded-2xl border p-5">
      <Halftone
        source="linear"
        direction={100}
        angle={15}
        pitch={2}
        channels={["blue", "purple"]}
        background="transparent"
        animate={false}
        className="absolute inset-y-0 right-0 -z-10 w-3/5 [mask-image:linear-gradient(to_right,transparent,#000_40%)]"
      />
      <span className="text-muted-foreground text-sm">Print runs</span>
      <span className="text-3xl font-semibold tracking-tight tabular-nums">
        3,912
      </span>
      <span className="text-muted-foreground mt-10 text-xs">
        Across 14 presses this month
      </span>
    </div>
  );
}
