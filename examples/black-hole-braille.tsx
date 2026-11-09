import { BlackHole } from "@/components/asciicn/black-hole";

export default function BlackHoleBraille() {
  return (
    <BlackHole
      charset="braille"
      tint="warm"
      tilt={12}
      cell={10}
      scale={1.2}
      className="aspect-video w-full max-w-2xl"
    />
  );
}
