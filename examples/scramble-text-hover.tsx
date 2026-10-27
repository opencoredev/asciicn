import { ScrambleText } from "@/components/asciicn/scramble-text";

const LINKS = ["Overview", "Components", "Engine", "Changelog"] as const;

export default function ScrambleTextHover() {
  return (
    <nav aria-label="Product">
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 font-mono text-sm">
        {LINKS.map((label) => (
          <li key={label}>
            <a
              href="#top"
              className="rounded-sm text-muted-foreground outline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ScrambleText
                glyphs="cp437"
                trigger="hover"
                duration={0.2}
                stagger={0.025}
              >
                {label}
              </ScrambleText>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
