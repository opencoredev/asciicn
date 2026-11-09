import { Paris } from "@/components/asciicn/paris";

// A 5px cell packs more dots into a small card, so the tower keeps its
// lattice; the river stays still without the boat.
export default function ParisFine() {
  return (
    <div className="relative isolate h-96 w-full max-w-2xl overflow-hidden rounded-xl">
      <Paris cell={5} boat={false} className="absolute inset-0" />
    </div>
  );
}
