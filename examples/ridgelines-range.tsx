import { Ridgelines } from "@/components/asciicn/ridgelines";

export default function RidgelinesRange() {
  return (
    <Ridgelines
      lines={40}
      spread={1}
      amplitude={0.7}
      shade={0.4}
      palette={["--ascii-paper", "--chart-5", "--chart-1"]}
      className="absolute inset-0"
    />
  );
}
