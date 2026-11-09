import { Miami } from "@/components/asciicn/miami";

// A 5px cell packs more dots into a small card, so the parapets, palms and
// windows keep their detail.
export default function MiamiFine() {
  return (
    <div className="relative isolate h-96 w-full max-w-2xl overflow-hidden rounded-xl">
      <Miami cell={5} className="absolute inset-0" />
    </div>
  );
}
