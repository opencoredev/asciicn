import { Eclipse } from "@/components/asciicn/eclipse";

// The same eclipse on an amber phosphor, in CP437 glyphs with a soft bloom.
export default function EclipseAmber() {
  return (
    <Eclipse
      size={0.18}
      corona={0.75}
      streamers={1}
      pulse={1}
      light={20}
      charset="cp437"
      colorMode="mono"
      phosphor="p3"
      fx={{ bloom: 0.7, vignette: 0.4 }}
      className="absolute inset-0"
    />
  );
}
