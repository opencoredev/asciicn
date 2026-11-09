import { London } from "@/components/asciicn/london";

// Thick mist on the river: the far end of the palace fades and the lamps blur.
export default function LondonMist() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl border">
      <London
        fog={1}
        boat={false}
        cell={6}
        className="absolute inset-0 -z-10"
      />
    </div>
  );
}
