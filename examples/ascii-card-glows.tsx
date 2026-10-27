import { AsciiCard } from "@/components/asciicn/ascii-card";

const CARDS = [
  { charset: "braille", color: "blue", glow: "top-left", title: "ingest" },
  { charset: "blocks", color: "purple", glow: "top", title: "transform" },
  { charset: "katakana", color: "green", glow: "top-right", title: "serve" },
] as const;

export default function AsciiCardGlows() {
  return (
    <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
      {CARDS.map((card) => (
        <AsciiCard
          key={card.title}
          title={card.title}
          glow={card.glow}
          glowCharset={card.charset}
          color={card.color}
          interactive
        >
          <a
            href="#top"
            className="font-display text-base font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {card.charset} glow
          </a>
          <p className="mt-1 text-sm text-muted-foreground">
            Lit from the {card.glow.replace("-", " ")}.
          </p>
        </AsciiCard>
      ))}
    </div>
  );
}
