import { AsciiFade } from "@/components/asciicn/ascii-fade";

const TAGS = [
  "braille",
  "blocks",
  "quadrants",
  "katakana",
  "petscii",
  "cp437",
  "halftone",
  "sobel",
  "classic",
  "dense",
] as const;

export default function AsciiFadeSides() {
  return (
    <div className="relative w-full max-w-md overflow-hidden bg-[var(--ascii-paper)] py-2">
      <ul className="flex w-max gap-2 font-mono text-sm">
        {TAGS.map((tag) => (
          <li key={tag} className="rounded-sm border px-2 py-1">
            {tag}
          </li>
        ))}
      </ul>
      <AsciiFade side="left" size={4} charset="quadrants" drift={false} />
      <AsciiFade side="right" size={14} charset="quadrants" drift={false} />
    </div>
  );
}
