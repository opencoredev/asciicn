import { GlitchText } from "@/components/asciicn/glitch-text";

const LINKS = ["Overview", "Components", "Engine", "Changelog"] as const;

export default function GlitchTextHover() {
  return (
    <nav aria-label="Product">
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 font-mono text-sm">
        {LINKS.map((label) => (
          <li key={label}>
            <a
              href="#top"
              className="rounded-sm text-muted-foreground outline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <GlitchText
                trigger="hover"
                glyphs="box"
                intensity={0.6}
                duration={0.25}
              >
                {label}
              </GlitchText>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
