import { Ionize } from "@/components/asciicn/ionize";

export default function IonizeMono() {
  return (
    <Ionize
      seed="arc-lamp"
      colorMode="mono"
      phosphor="blueprint"
      fx={{ bloom: 0.6, scanlines: 0.35, vignette: 0.4 }}
      className="absolute inset-0"
    />
  );
}
