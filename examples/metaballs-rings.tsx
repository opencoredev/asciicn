import { Metaballs } from "@/components/asciicn/metaballs";

// Contour rings around each blob, drawn as fine Braille lines.
export default function MetaballsRings() {
  return (
    <Metaballs
      variant="rings"
      count={4}
      charset="braille"
      className="absolute inset-0"
    />
  );
}
