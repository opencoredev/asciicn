import { BalloonValley } from "@/components/asciicn/balloon-valley";

// The same valley read by tone alone through a two-ink ramp, in a card.
export default function BalloonValleyDuotone() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl">
      <BalloonValley
        colorMode="duotone"
        ramp={["#ebdfcf", "#d9a273", "#8a6a8f", "#33406b"]}
        cell={6}
        className="absolute inset-0"
      />
    </div>
  );
}
