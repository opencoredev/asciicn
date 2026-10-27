import { London } from "@/components/asciicn/london";

// The sodium ramp turns the fog to lamplight: one hue from shadow to flame.
export default function LondonDuotone() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl border">
      <London
        charset="braille"
        colorMode="duotone"
        ramp="sodium"
        grade={{ gamma: 1.7 }}
        fog={0.9}
        bus={false}
        cell={10}
        className="absolute inset-0 -z-10"
      />
    </div>
  );
}
