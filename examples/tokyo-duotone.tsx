import { Tokyo } from "@/components/asciicn/tokyo";

// Duotone runs each dot's tone through one ramp: the city in sodium amber,
// drawn by dot size alone.
export default function TokyoDuotone() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl bg-[#0d0600]">
      <Tokyo colorMode="duotone" ramp="sodium" className="absolute inset-0" />
    </div>
  );
}
