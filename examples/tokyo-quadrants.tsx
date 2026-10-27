import { Tokyo } from "@/components/asciicn/tokyo";

// Quadrant blocks at a slightly larger cell: bolder shapes and solid colour.
export default function TokyoQuadrants() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl bg-[#03050d]">
      <Tokyo charset="quadrants" cell={10} className="absolute inset-0" />
    </div>
  );
}
