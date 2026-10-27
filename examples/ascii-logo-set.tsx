import { AsciiLogo } from "@/components/asciicn/ascii-logo";
import { LOGOS } from "@/examples/ascii-logo-data";

export default function AsciiLogoSet() {
  return (
    <div className="grid w-full grid-cols-2 place-items-center gap-x-8 gap-y-10 sm:grid-cols-4">
      {LOGOS.map((logo, index) => (
        <AsciiLogo
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          ratio={logo.ratio}
          color="grey"
          effect="scan"
          period={8}
          phase={index / LOGOS.length}
          cell={5}
          className="h-10 max-w-full"
        />
      ))}
    </div>
  );
}
