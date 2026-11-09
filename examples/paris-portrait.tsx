import { Paris } from "@/components/asciicn/paris";

// A tall card, the shape of a phone screen: the tower stands in the middle
// with the river below it.
export default function ParisPortrait() {
  return (
    <div className="relative isolate h-[560px] w-[264px] overflow-hidden rounded-[2rem] border border-white/10">
      <Paris className="absolute inset-0" />
    </div>
  );
}
