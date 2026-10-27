import { AsciiLogo } from "@/components/asciicn/ascii-logo";

export default function AsciiLogoEdge() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <AsciiLogo
        src="/examples/logos/orbitline.svg"
        alt="Orbitline"
        ratio={166 / 40}
        charset="edge"
        edgeThreshold={0.3}
        color="blue"
        cell={9}
        className="w-full"
      />
      <AsciiLogo
        src="/examples/logos/lumenade.svg"
        alt="Lumenade"
        ratio={203 / 40}
        charset="blocks"
        colorMode="duotone"
        ramp="ember"
        effect="reveal"
        cell={8}
        className="w-full"
      />
    </div>
  );
}
