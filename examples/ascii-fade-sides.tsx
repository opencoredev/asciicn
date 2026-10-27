import { AsciiFade } from "@/components/asciicn/ascii-fade";

const TAGS = [
  "Bayer 2",
  "Bayer 4",
  "Bayer 8",
  "Blue noise",
  "Floyd–Steinberg",
  "Atkinson",
  "Sierra Lite",
  "Palettes",
  "Cells",
] as const;

export default function AsciiFadeSides() {
  return (
    <div className="relative w-full max-w-md overflow-hidden py-2">
      <ul className="flex w-max gap-2">
        {TAGS.map((tag) => (
          <li
            key={tag}
            className="border-border text-muted-foreground rounded-full border px-3 py-1 text-sm whitespace-nowrap"
          >
            {tag}
          </li>
        ))}
      </ul>
      <AsciiFade side="left" size={48} />
      <AsciiFade side="right" size={96} />
    </div>
  );
}
