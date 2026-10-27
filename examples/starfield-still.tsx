import { Starfield } from "@/components/asciicn/starfield";

export default function StarfieldStill() {
  return (
    <Starfield
      drift={0}
      twinkle={1}
      nebula={0}
      density={0.6}
      palette={["--ascii-paper", "--muted-foreground", "--foreground"]}
      className="absolute inset-0"
    />
  );
}
