import { Miami } from "@/components/asciicn/miami";

// One duotone ramp, Braille dots and a CRT finish: Ocean Drive on a tape.
export default function MiamiVapor() {
  return (
    <div className="absolute inset-0 bg-[#0d0618]">
      <Miami
        charset="braille"
        colorMode="duotone"
        ramp="vapor"
        paper="#0d0618"
        traffic={1}
        sway={1.6}
        fx={{ bloom: 0.5, scanlines: 0.35, vignette: 0.45 }}
        className="absolute inset-0"
      />
    </div>
  );
}
