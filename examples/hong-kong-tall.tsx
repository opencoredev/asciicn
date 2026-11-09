import { HongKong } from "@/components/asciicn/hong-kong";

// A phone-shaped card: in a narrow box the Bank of China Tower and Two IFC
// move to the edges and the Peak stays centred, so all three stay in view.
export default function HongKongTall() {
  return (
    <div className="relative isolate aspect-[9/19] w-56 overflow-hidden rounded-[2rem] border border-white/10 bg-[#060818]">
      <HongKong className="absolute inset-0" />
    </div>
  );
}
