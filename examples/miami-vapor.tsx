import { Miami } from "@/components/asciicn/miami";

// One duotone ramp and a CRT finish: Ocean Drive on a tape.
export default function MiamiVapor() {
  return (
    <div className="absolute inset-0 bg-[#0d0618]">
      <Miami
        colorMode="duotone"
        ramp="vapor"
        paper="#0d0618"
        fx={{ bloom: 0.5, scanlines: 0.35, vignette: 0.45 }}
        className="absolute inset-0"
      />
    </div>
  );
}
