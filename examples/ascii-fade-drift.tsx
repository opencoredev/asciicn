import { AsciiFade } from "@/components/asciicn/ascii-fade";

export default function AsciiFadeDrift() {
  return (
    <div className="relative size-full overflow-hidden bg-[var(--ascii-ink)]">
      <p className="p-8 font-display text-3xl font-bold tracking-tight text-[var(--ascii-paper)]">
        Fade into the page through braille dots.
      </p>
      <AsciiFade side="bottom" size={18} charset="braille" cell={10} />
    </div>
  );
}
