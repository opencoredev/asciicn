import { Aurora } from "@/components/asciicn/aurora";

// A real night sky: green edges, violet tips, deep blue paper.
export default function AuroraBorealis() {
  return (
    <div className="absolute inset-0 bg-[oklch(0.14_0.03_250)]">
      <Aurora
        paper="oklch(0.14 0.03 250)"
        ink="oklch(0.86 0.2 150)"
        tipColor="oklch(0.6 0.2 305)"
        curtains={4}
        height={0.28}
        spread={0.08}
        sway={1.6}
        rays={11}
        length={0.7}
        tilt={-6}
        drift={0.5}
        className="absolute inset-0"
      />
    </div>
  );
}
