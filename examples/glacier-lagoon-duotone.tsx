import { GlacierLagoon } from "@/components/asciicn/glacier-lagoon";

// The glacier ramp reads the scene by brightness alone: teal shadow to white ice.
export default function GlacierLagoonDuotone() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl border">
      <GlacierLagoon
        colorMode="duotone"
        ramp="glacier"
        mist={false}
        cell={9}
        className="absolute inset-0 -z-10"
      />
    </div>
  );
}
