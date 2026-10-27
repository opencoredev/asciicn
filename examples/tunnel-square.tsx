import { Tunnel } from "@/components/asciicn/tunnel";

export default function TunnelSquare() {
  return (
    <Tunnel
      shape="square"
      spokes={16}
      rings={1.4}
      center={[0.5, 0.42]}
      sway={0.4}
      charset="petscii"
      colorMode="ansi16"
      ansi="vga"
      className="absolute inset-0"
    />
  );
}
