import { RiceTerraces } from "@/components/asciicn/rice-terraces";

// A wide, short banner at a 6px cell: finer dots, so the terraces keep
// their steps in a strip only a few hundred pixels tall.
export default function RiceTerracesBanner() {
  return (
    <div className="relative isolate flex h-56 w-full max-w-3xl items-end overflow-hidden rounded-xl p-5">
      <RiceTerraces cell={6} bird={false} className="absolute inset-0 -z-10" />
      <p className="rounded-md bg-[#0c0d22]/70 px-2.5 py-1 font-mono text-xs text-white/85 backdrop-blur-sm">
        Field notes · issue 12
      </p>
    </div>
  );
}
