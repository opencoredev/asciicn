import { ServerRack } from "@/components/asciicn/server-rack";

// Plain ASCII on a green phosphor, behind a status headline.
export default function ServerRackTerminal() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-end gap-2 p-8">
      <ServerRack
        charset="standard"
        phosphor="p1"
        intensity={0.5}
        activity={0.4}
        units={24}
        fx={{ bloom: 0.4, scanlines: 0.35, vignette: 0.5 }}
        className="absolute inset-0 -z-10"
      />
      <h3 className="rounded bg-black/70 px-2 py-1 font-mono text-2xl text-[#33ff66]">
        All systems nominal
      </h3>
      <p className="rounded bg-black/70 px-2 py-1 font-mono text-sm text-[#33ff66]/80">
        412 hosts · 99.998% uptime this quarter
      </p>
    </section>
  );
}
