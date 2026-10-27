import { Beams } from "@/components/asciicn/beams";

// A far origin above the box gives near-parallel shafts, like light through
// a high window, on an amber monitor.
export default function BeamsAmber() {
  return (
    <div className="relative isolate flex h-72 w-full max-w-xl flex-col justify-between overflow-hidden rounded-xl border border-[#3a2800] bg-[#0c0700] p-4 font-mono text-xs text-[#ffb000]">
      <Beams
        origin={[0.3, -2.5]}
        angle={170}
        spread={40}
        rays={6}
        reach={0.55}
        colorMode="mono"
        phosphor="p3"
        fx={{ bloom: 0.6, scanlines: 0.4, vignette: 0.5 }}
        className="absolute inset-0 -z-10"
      />
      <span className="opacity-70">VAULT-7 · LIGHTING</span>
      <span>&gt; skylight 3 open. dust count nominal.</span>
    </div>
  );
}
