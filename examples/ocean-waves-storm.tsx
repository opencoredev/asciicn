import { OceanWaves } from "@/components/asciicn/ocean-waves";

// A dark night in a gale: no moon, heavy swell, foam on every crest.
export default function OceanWavesStorm() {
  return (
    <OceanWaves
      moon={false}
      swell={1}
      wind={0.9}
      phosphor="blueprint"
      fx={{ scanlines: 0.3, vignette: 0.45 }}
      className="absolute inset-0"
    />
  );
}
