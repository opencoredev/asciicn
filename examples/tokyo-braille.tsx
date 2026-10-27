import { Tokyo } from "@/components/asciicn/tokyo";

// Braille at the default cell: the finest lattice, in lighter dots.
export default function TokyoBraille() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl bg-[#03050d]">
      <Tokyo charset="braille" className="absolute inset-0" />
    </div>
  );
}
