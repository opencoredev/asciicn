import { SynthwaveSun } from "@/components/asciicn/synthwave-sun";

export default function SynthwaveSunPhosphor() {
  return (
    <SynthwaveSun
      charset="quadrants"
      phosphor="p3"
      mountains={1.4}
      slices={0.8}
      fx={{ bloom: 0.5, scanlines: 0.45, vignette: 0.4 }}
      className="aspect-video w-full max-w-2xl"
    />
  );
}
