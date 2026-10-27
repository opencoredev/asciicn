import { Metaballs } from "@/components/asciicn/metaballs";

// Three warm waxes that blend as they merge, in a tall rounded lamp.
export default function MetaballsLamp() {
  return (
    <div className="border-border relative h-96 w-56 overflow-hidden rounded-[3rem] border">
      <Metaballs
        count={5}
        size={0.95}
        speed={1.2}
        colorMode="truecolor"
        colors={[
          "oklch(0.6 0.2 20)",
          "oklch(0.72 0.19 45)",
          "oklch(0.86 0.15 85)",
        ]}
        className="absolute inset-0"
      />
    </div>
  );
}
