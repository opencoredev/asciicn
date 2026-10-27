import { Ridgelines } from "@/components/asciicn/ridgelines";

export default function RidgelinesRange() {
  return (
    <Ridgelines
      lines={40}
      spread={1}
      amplitude={0.7}
      shade={0.4}
      charset="quadrants"
      colorMode="truecolor"
      farColor="blue"
      className="absolute inset-0"
    />
  );
}
