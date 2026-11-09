import { Rio } from "@/components/asciicn/rio";

// Gold duotone on finer dots: the bay as a single-ink print in a card.
export default function RioDuotone() {
  return (
    <div className="relative isolate flex h-80 w-full max-w-2xl flex-col justify-end overflow-hidden rounded-xl border border-white/10 p-5">
      <Rio colorMode="duotone" cell={5} className="absolute inset-0 -z-10" />
      <p className="font-mono text-xs text-[#fcb442]/80">
        22.95°S 43.16°W · Baía de Guanabara
      </p>
    </div>
  );
}
