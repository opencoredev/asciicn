import { CanyonRiver } from "@/components/asciicn/canyon-river";

// One amber phosphor and classic glyphs in tall cells: the canyon on an old monitor.
export default function CanyonRiverPhosphor() {
  return (
    <div className="relative isolate flex h-80 w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#3a2a0a] bg-[#0a0700] font-mono">
      <CanyonRiver
        charset="standard"
        colorMode="mono"
        phosphor="p3"
        cell={10}
        square={false}
        fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.45 }}
        className="absolute inset-0 -z-10"
      />
      <div className="flex items-center justify-between border-b border-[#3a2a0a] bg-[#0a0700]/80 px-3 py-1.5 text-[11px] text-[#ffb000]/70">
        <span>rim.cam</span>
        <span>19:42 · dusk</span>
      </div>
    </div>
  );
}
