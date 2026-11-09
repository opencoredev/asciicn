import { Dubai } from "@/components/asciicn/dubai";

// The same dusk read by tone alone through a two-ink ramp, in a card.
export default function DubaiDuotone() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl">
      <Dubai
        colorMode="duotone"
        ramp={["#0e0a24", "#4a2a64", "#d9725a", "#ffe0a6"]}
        cell={6}
        className="absolute inset-0"
      />
    </div>
  );
}
