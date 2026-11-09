import { Tokyo } from "@/components/asciicn/tokyo";

// A phone-shaped card: Fuji and the tower keep to the edges of the frame,
// so both stay in view around a centred headline.
export default function TokyoTall() {
  return (
    <div className="relative isolate aspect-[9/19] w-56 overflow-hidden rounded-[2rem] border border-white/10 bg-[#050b0e]">
      <Tokyo className="absolute inset-0" />
    </div>
  );
}
