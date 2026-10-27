import { AsciiText } from "@/components/asciicn/ascii-text";

const LINKS = ["Docs", "Studio", "Scenes"] as const;

export default function AsciiTextHover() {
  return (
    <nav aria-label="Sections" className="flex flex-wrap justify-center gap-8">
      {LINKS.map((label) => (
        <a
          key={label}
          href="#top"
          className="rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <AsciiText
            as="span"
            charset="quadrants"
            reveal="wipe"
            trigger="hover"
            duration={0.6}
            cell={6}
            size={56}
            fit={false}
            className="font-display font-bold"
          >
            {label}
          </AsciiText>
        </a>
      ))}
    </nav>
  );
}
