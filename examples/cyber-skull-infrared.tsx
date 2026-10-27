import { CyberSkull } from "@/components/asciicn/cyber-skull";

export default function CyberSkullInfrared() {
  return (
    <CyberSkull
      shading="solid"
      surface="smooth"
      charset="dense"
      colorMode="duotone"
      ramp="infrared"
      eyes={false}
      speed={-0.35}
      cell={9}
      className="aspect-[4/3] w-full max-w-xl"
    />
  );
}
