import { Avatar } from "@/components/asciicn/avatar";
import type { AvatarProps } from "@/components/asciicn/avatar";

const LOOKS: readonly { caption: string; props: Partial<AvatarProps> }[] = [
  { caption: "braille", props: { charset: "braille" } },
  { caption: "dense", props: { charset: "dense" } },
  { caption: "blocks", props: { charset: "blocks" } },
  {
    caption: "truecolor",
    props: { charset: "dense", colorMode: "truecolor" },
  },
];

export default function AvatarPortraits() {
  return (
    <ul className="grid w-full max-w-md grid-cols-2 justify-items-center gap-8">
      {LOOKS.map((look) => (
        <li key={look.caption} className="flex flex-col items-center gap-3">
          <Avatar
            name="Buzz Aldrin"
            src="/examples/aldrin.jpg"
            size={160}
            {...look.props}
          />
          <span className="text-muted-foreground font-mono text-xs">
            {look.caption}
          </span>
        </li>
      ))}
    </ul>
  );
}
