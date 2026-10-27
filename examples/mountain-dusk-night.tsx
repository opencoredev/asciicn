import { MountainDusk } from "@/components/asciicn/mountain-dusk";

// Full night in Braille: the moon high, the sky thick with stars.
export default function MountainDuskNight() {
  return (
    <MountainDusk
      charset="braille"
      time={1}
      stars={1}
      layers={6}
      mist={0.9}
      className="absolute inset-0"
    />
  );
}
