import { Paris } from "@/components/asciicn/paris";

// Braille at a 7px cell: eight dots per glyph trace every bar of the lattice.
export default function ParisBraille() {
  return (
    <div className="relative isolate h-96 w-full max-w-2xl overflow-hidden rounded-xl">
      <Paris
        charset="braille"
        cell={7}
        boat={false}
        className="absolute inset-0"
      />
    </div>
  );
}
