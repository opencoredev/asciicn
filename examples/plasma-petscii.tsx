import { Plasma } from "@/components/asciicn/plasma";

// Big PETSCII cells and a held frame: a demoscene title card.
export default function PlasmaPetscii() {
  return (
    <div className="relative isolate flex size-full items-center justify-center">
      <Plasma
        charset="petscii"
        colorMode="ansi16"
        cell={18}
        bands={2}
        animate={false}
        className="absolute inset-0 -z-10"
      />
      <span className="bg-background border-border border px-3 py-1.5 font-mono text-sm tracking-[0.2em] uppercase">
        Greetings to all coders
      </span>
    </div>
  );
}
