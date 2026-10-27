import { Aurora } from "@/components/asciicn/aurora";

// One phosphor, a CRT finish and classic glyphs: an aurora on a 1980s monitor.
export default function AuroraTerminal() {
  return (
    <div className="relative isolate flex h-72 w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#0f3a1a] bg-[#020a04] font-mono">
      <Aurora
        charset="standard"
        colorMode="mono"
        phosphor="p1"
        curtains={2}
        height={0.3}
        rays={6}
        length={0.6}
        fx={{ bloom: 0.5, scanlines: 0.45, vignette: 0.4 }}
        className="absolute inset-0 -z-10"
      />
      <div className="flex items-center justify-between border-b border-[#0f3a1a] px-3 py-1.5 text-[11px] text-[#33ff66]/70">
        <span>skywatch.sh</span>
        <span>kp 6 · storm</span>
      </div>
      <p className="mt-auto px-3 pb-3 text-xs text-[#33ff66]">
        &gt; geomagnetic activity high. look north after 23:00
      </p>
    </div>
  );
}
