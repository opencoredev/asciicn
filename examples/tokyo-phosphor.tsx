import { Tokyo } from "@/components/asciicn/tokyo";

// One phosphor, classic glyphs and a CRT finish: the city on an old monitor.
export default function TokyoPhosphor() {
  return (
    <div className="relative isolate flex h-80 w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#3a2a00] bg-[#0a0700] font-mono">
      <Tokyo
        charset="standard"
        colorMode="mono"
        phosphor="p3"
        cell={11}
        fx={{ bloom: 0.5, scanlines: 0.4, vignette: 0.45 }}
        className="absolute inset-0 -z-10"
      />
      <div className="flex items-center justify-between border-b border-[#3a2a00] bg-[#0a0700]/80 px-3 py-1.5 text-[11px] text-[#ffb000]/70">
        <span>minato-ku.cam</span>
        <span>23:41 jst</span>
      </div>
    </div>
  );
}
