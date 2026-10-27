import { Plasma } from "@/components/asciicn/plasma";

// Duotone mode reads the tone through a named ramp instead of the palette.
export default function PlasmaPalette() {
  return (
    <Plasma
      colorMode="duotone"
      ramp="outrun"
      charset="dense"
      bands={1.6}
      crest={0.3}
      className="absolute inset-0"
    />
  );
}
