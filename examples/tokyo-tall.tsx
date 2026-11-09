import { Tokyo } from "@/components/asciicn/tokyo";

// A phone-shaped card: in a narrow box Fuji and the tower move in towards
// the centre, so both stay in the crop.
export default function TokyoTall() {
  return (
    <div className="relative isolate aspect-[9/19] w-56 overflow-hidden rounded-[2rem] border border-white/10 bg-[#070818]">
      <Tokyo className="absolute inset-0" />
    </div>
  );
}
