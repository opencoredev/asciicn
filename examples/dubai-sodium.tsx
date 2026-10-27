import { Dubai } from "@/components/asciicn/dubai";

// Two colours from a ramp and shaded blocks: the skyline as a sodium-lamp print.
export default function DubaiSodium() {
  return (
    <div className="relative isolate h-80 w-full overflow-hidden rounded-xl">
      <Dubai
        charset="blocks"
        colorMode="duotone"
        ramp="sodium"
        cell={10}
        className="absolute inset-0"
      />
    </div>
  );
}
