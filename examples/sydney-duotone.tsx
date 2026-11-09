import { Sydney } from "@/components/asciicn/sydney";

// One blue ramp for every tone: the harbour reads by dot size alone.
export default function SydneyDuotone() {
  return (
    <Sydney
      colorMode="duotone"
      ramp="heliograph"
      ferry={false}
      className="absolute inset-0"
    />
  );
}
