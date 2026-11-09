import { Lighthouse } from "@/components/asciicn/lighthouse";

// No stars, no clouds and a lower intensity: a calm strip behind a sign-up form.
export default function LighthouseQuiet() {
  return (
    <div className="relative isolate flex h-72 w-full max-w-2xl flex-col justify-end overflow-hidden rounded-xl p-6 text-white">
      <Lighthouse
        intensity={0.45}
        stars={false}
        clouds={false}
        className="absolute inset-0 -z-10"
      />
      <p className="font-mono text-xs tracking-[0.2em] text-white/60 uppercase">
        Harbour notes
      </p>
      <p className="mt-1 max-w-xs text-lg font-medium text-balance">
        One letter a month from the coast.
      </p>
    </div>
  );
}
