import { Paris } from "@/components/asciicn/paris";

// One amber phosphor, a CRT finish and dense glyphs: Paris on an old monitor.
export default function ParisPhosphor() {
  return (
    <div className="relative isolate flex h-80 w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#3a2a0a] bg-[#0a0700] font-mono">
      <Paris
        charset="dense"
        colorMode="mono"
        phosphor="p3"
        sparkle={0.5}
        cell={10}
        fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.45 }}
        className="absolute inset-0 -z-10"
      />
      <div className="flex items-center justify-between border-b border-[#3a2a0a] bg-[#0a0700]/80 px-3 py-1.5 text-[11px] text-[#ffb000]/70">
        <span>paris.cam</span>
        <span>21:00 · 48.86N 2.29E</span>
      </div>
    </div>
  );
}
