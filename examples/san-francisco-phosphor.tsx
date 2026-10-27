import { SanFrancisco } from "@/components/asciicn/san-francisco";

// Amber phosphor and a heavy fog: the bridge on an old terminal.
export default function SanFranciscoPhosphor() {
  return (
    <SanFrancisco
      phosphor="p3"
      charset="dense"
      fog={0.9}
      fx={{ bloom: 0.45, scanlines: 0.4, vignette: 0.4 }}
      className="absolute inset-0"
    />
  );
}
