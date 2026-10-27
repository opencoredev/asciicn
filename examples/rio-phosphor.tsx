import { Rio } from "@/components/asciicn/rio";

// One green phosphor, Braille dots and a CRT finish: Rio on an old monitor.
export default function RioPhosphor() {
  return (
    <div className="relative isolate flex h-80 w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#0f3a1a] bg-[#020a04] font-mono">
      <Rio
        charset="braille"
        colorMode="mono"
        phosphor="p1"
        surf={0.9}
        cell={11}
        fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.45 }}
        className="absolute inset-0 -z-10"
      />
      <div className="flex items-center justify-between border-b border-[#0f3a1a] bg-[#020a04]/80 px-3 py-1.5 text-[11px] text-[#33ff66]/70">
        <span>copacabana.cam</span>
        <span>17:20 · 22.97S 43.18W</span>
      </div>
    </div>
  );
}
