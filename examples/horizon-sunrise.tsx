import { Horizon } from "@/components/asciicn/horizon";

// A flatter horizon, a warm rim fading to pink haze, in Dense 70 glyphs.
export default function HorizonSunrise() {
  return (
    <Horizon
      horizon={0.38}
      curve={0.25}
      aurora={0.3}
      stars={0.5}
      charset="dense"
      ink="oklch(0.82 0.15 65)"
      hazeColor="pink"
      className="absolute inset-0"
    />
  );
}
