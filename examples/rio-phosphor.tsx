import { Rio } from "@/components/asciicn/rio";

// One green phosphor, Braille dots and a CRT finish: Rio on an old monitor.
export default function RioPhosphor() {
  return (
    <div className="relative isolate flex h-80 w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#0f3a1a] bg-[#020a04] font-mono">
      <Rio
        charset="braille"
        colorMode="mono"
        phosphor="p1"
        fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.45 }}
        className="absolute inset-0 -z-10"
      />
      <div className="flex items-center justify-between border-b border-[#0f3a1a] bg-[#020a04]/80 px-3 py-1.5 text-[11px] text-[#33ff66]/70">
        <span>baia.cam</span>
        <span>22:40 · 22.95S 43.16W</span>
      </div>
    </div>
  );
}
