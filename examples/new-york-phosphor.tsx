import { NewYork } from "@/components/asciicn/new-york";

// One green phosphor, braille dots and a CRT finish: Manhattan on a surveillance monitor.
export default function NewYorkPhosphor() {
  return (
    <div className="relative isolate flex h-80 w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#0f3a1a] bg-[#020a04] font-mono">
      <NewYork
        charset="braille"
        colorMode="mono"
        phosphor="p1"
        windows={0.65}
        cell={10}
        fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.45 }}
        className="absolute inset-0 -z-10"
      />
      <div className="flex items-center justify-between border-b border-[#0f3a1a] bg-[#020a04]/80 px-3 py-1.5 text-[11px] text-[#33ff66]/70">
        <span>east-river.cam</span>
        <span>23:40 · 40.70N 73.99W</span>
      </div>
    </div>
  );
}
