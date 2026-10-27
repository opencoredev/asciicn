import { HongKong } from "@/components/asciicn/hong-kong";

// One ramp and dense glyphs: the harbour as a two-colour print.
export default function HongKongDuotone() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl">
      <HongKong
        charset="dense"
        colorMode="duotone"
        ramp="vapor"
        cell={11}
        className="absolute inset-0"
      />
    </div>
  );
}
